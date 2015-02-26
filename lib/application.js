/**
* @module coalescent/application
*/

var async = require('async');
var stream = require('stream');
var util = require('util');
var net = require('net');
var merge = require('merge');
var through = require('through');
var hat = require('hat');
var es = require('event-stream');
var konduit = require('konduit');

util.inherits(Application, stream.Duplex);

Application.DEFAULTS = {
  minPeers: 3,
  maxPeers: 12,
  seeds: [],
  logger: console,
  retryInterval: 5000
};

/**
* P2P application framework
* @constructor
* @param {object} options
*/
function Application(options) {
  var self = this;

  stream.Duplex.call(self, { objectMode: true });

  self.id = hat();
  self.server = net.createServer(self._handleInbound.bind(self));
  self.options = merge(Object.create(Application.DEFAULTS), options);
  self.connections = { inbound: [], outbound: [] };

  // setup middlware stack with initial entry a simple passthrough
  self.stack = [function(socket) {
    return through(function(data) { this.queue(data) });
  }];

  Object.defineProperty(self, 'log', {
    value: this.options.logger || {
      info: NOOP, warn: NOOP, error: NOOP
    }
  });

  // connect to seeds
  self._enterNetwork()
  setInterval(self._enterNetwork.bind(self), self.options.retryInterval);
};

/**
* Register middleware function
* #use
* @param {function} middleware
* @see README.md
*/
Application.prototype.use = function(middleware) {
  var self  = this;

  if (!Array.isArray(middleware)) {
    middleware = [middleware];
  }

  middleware.forEach(function(ware) {
    if (typeof ware !== 'function') {
      throw new TypeError('Middleware must be a function');
    }

    // if a there is a _plugin implemented, initialize it
    if (typeof ware._plugin === 'function') {
      ware._plugin(self);
    }

    // the `stack` is a "template" used to initialize the middleware pipeline
    self.stack.push(ware);
  });

  return self;
};

/**
* Set a custom application option after intatiation
* #set
* @param {string} key
* @param {mixed} value
*/
Application.prototype.set = function(key, value) {
  return this.options[key] = value;
};

/**
* Get a custom application option
* #get
* @param {string} key
*/
Application.prototype.get = function(key) {
  return this.options[key] || null;
};

/**
* Start TCP server listening
* #listen
* @see https://iojs.org/api/net.html#net_server_listen_options_callback
*/
Application.prototype.listen = function() {
  var args = Array.prototype.slice.call(arguments);

  this.log.info('Starting server on port ' + args[0]);
  this.server.listen.apply(this.server, args);

  return this.server;
};

/**
* Open connection to a known peer
* #connect
* @see https://iojs.org/api/net.html#net_net_connect_options_connectionlistener
*/
Application.prototype.connect = function() {
  var self = this;
  var args = Array.prototype.slice.call(arguments);
  var socket = net.connect.apply(this, args);

  self.log.info('Opening connection to peer');

  // track in outbound connections
  self.connections.outbound.push(socket);

  // fire all middleware _connect() implementations
  socket.on('connect', function() {
    self._process(socket);
    self.emit('peerConnected', socket.address());
  });

  // cleanup after losing outbound connection
  socket.on('end', function() {
    self._cleanup(socket);
    self.emit('peerDisconnected', socket.address());
  });

  return socket;
};

/**
* Get array of all peers, optionally firing the given iterator function
* #peers
* @param {function} iterator - optional
*/
Application.prototype.peers = function(iterator) {
  var handles = [];
  var addresses = [];
  var inbound = this.connections.inbound;
  var outbound = this.connections.outbound;
  var everyone = [].concat(inbound).concat(outbound).filter(dedup);

  if (typeof iterator === 'function') {
    everyone.forEach(iterator);
  }

  function dedup(sock) {
    if (sock._handle) {
      var fdesc = sock._handle.fd;

      if (handles.indexOf(url) !== -1) {
        return false;
      }

      handles.push(fdesc);
    }

    if (sock.address()) {
      var url = sock.address().address + ':' + sock.address().port;

      if (addresses.indexOf(url) !== -1) {
        return false;
      }

      addresses.push(url);
    }

    return true;
  };

  return everyone;
};

/**
* Sever connections with all peers and stop acception new connections
* #destroy
* @param {function} callback
*/
Application.prototype.destroy = function(callback) {
  var self = this;

  self.peers(function(socket) {
    socket.destroy();
    self._cleanup(socket);
  });

  self.server.close(callback);
};

/**
* Attempt to connect to known seeds
* #_enterNetwork
*/
Application.prototype._enterNetwork = function() {
  var self = this;
  var active = self.connections.outbound.filter(function(c) {
    return !c._connecting;
  });

  if (self.options.maxPeers <= active.length) {
    return;
  }

  if (self.options.minPeers <= active.length) {
    return;
  }

  self.options.seeds.forEach(function(seed) {
    var host = seed.split(':')[0];
    var port = seed.split(':')[1];

    for (var a = 0; a < active.length; a++) {
      var remoteAddr = active[a].remoteAddress;
      var remotePort = active[a].remotePort;

      if (host === 'localhost' || remoteAddr === '127.0.0.1') {
        return;
      }

      if (host === remoteAddr && port === remotePort) {
        return;
      }
    }

    var socket = self.connect(port, host);

    socket.on('error', function(err) {
      self._cleanup(socket);
      self.log.error('Failed to connect to peer', err.message);
    });
  });
};

/**
* Setup peer connection to proxy through middlewaare pipeline
* #_process
* @param {object} socket
*/
Application.prototype._process = function(socket) {
  var self  = this;
  var stack = self._initMiddlewareStack(socket);

  self.log.info('Processing socket ', socket.address());

  socket.pipe(stack[0]);

  return stack[stack.length - 1];
};

/**
* Create a new middleware stack and initialize the given peer
* #_initMiddlewareStack
* @param {object} socket
*/
Application.prototype._initMiddlewareStack = function(socket) {
  var self = this
  var pipeline = konduit.createPipeline({ log: self.logger });

  pipeline.on('data', function(d) {
    self.push(d);
  });

  // initialize each middleware with the given peer
  var stack = self.stack.map(function(wareFn, index) {
    return wareFn(socket);
  });

  // take peer-scoped staack and create insert into pipeline
  stack.forEach(function(ware, index) {
    pipeline.use(ware);

    if (typeof ware._init === 'function') {
      ware._init(self, socket);
    }

    return ware;
  });

  pipeline.open();

  return stack;
};

/**
* Remove reference to given socket from application
* #_cleanup
* @param {object} socket
*/
Application.prototype._cleanup = function(socket) {
  [
    this.connections.inbound,
    this.connections.outbound
  ].forEach(function(list) {
    list.forEach(function(sock, i) {
      if (sock === socket) {
        list.splice(i, 1);
      }
    });
  });
};

/**
* Stubbed _read method for duplex streams
* #_read
*/
Application.prototype._read = NOOP;

/**
* Implemented _write for duplex streams (broadcasts message to peers)
* #_write
* @see https://iojs.org/api/stream.html#stream_api_for_stream_implementors
*/
Application.prototype._write = function(chunk, encoding, callback) {
  var self = this;

  self.peers(function(p) {
    if (Buffer.isBuffer(chunk)) {
      return p.write(chunk.toString());
    }

    if (typeof chunk === 'string') {
      return p.write(chunk);
    }

    try {
      return p.write(JSON.stringify(chunk));
    } catch(err) {
      self.log.error(err);
    }
  });

  callback();
};

/**
* Application server connection handler
* #_handleInbound
* @param {object} socket
*/
Application.prototype._handleInbound = function(socket) {
  var self = this;
  var addr = socket.address();
  var remote = addr ? addr.address + ':' + addr.port : '?';

  self.log.info('Handling inbound connection from ' + remote);

  socket.on('end', function() {
    self._cleanup(socket);
    self.emit('peerDisconnected', socket.address());
  });

  self.connections.inbound.push(socket);

  self._process(socket);
  self.emit('peerConnected', socket.address());
};

function NOOP() {};

module.exports = Application;
