var async   = require('async');
var stream  = require('stream');
var util    = require('util');
var net     = require('net');
var merge   = require('merge');
var through = require('through');
var hat     = require('hat');
var es      = require('event-stream');

// default options
var DEFAULTS = {
  minPeers: 3,
  maxPeers: 12,
  seeds: [],
  logger: console
};

function Application(options) {
  var self = this;

  stream.Duplex.call(self, { objectMode: true });

  self.id          = hat();
  self.server      = net.createServer(self._handleInbound.bind(self));
  self.stack       = [through(function(data) { this.queue(data) })];
  self.options     = merge(DEFAULTS, options);
  self.connections = { inbound: [], outbound: [] };

  // setup logger
  Object.defineProperty(self, 'log', { value: this.options.logger });

  // connect to seeds
  setInterval(function() { self._enterNetwork() }, 5000)
};

util.inherits(Application, stream.Duplex);

Application.prototype.use = function(middleware) {
  var self  = this;

  if (!Array.isArray(middleware)) middleware = [middleware];

  middleware.forEach(function(ware) {
    if (!ware.pipe) {
      throw new TypeError('Middleware must inherit from stream');
    }

    // register the tranform stream in the stack
    self.stack.push(ware);

    // if an _init() method is implemented, call it
    if (typeof ware._init === 'function') ware._init(self);
  });

  return self;
};

Application.prototype.input = function() {
  var stack = this.stack.slice(0);

  stack.map(function(ware, index) {
    if (index) {
      stack[index - 1].pipe(ware);
    }

    return ware;
  })[stack.length - 1].pipe(this);

  return stack;
};

Application.prototype.set = function(key, value) {
  return this.opts[key] = value;
};

Application.prototype.get = function(key) {
  return this.opts[key] || null;
};

Application.prototype.listen = function() {
  var args = Array.prototype.slice.call(arguments);
  // pipe the last item in stack to application before listening
  this.log.info('Starting server on port ' + args[0]);
  return this.server.listen.apply(this.server, args);
};

Application.prototype.connect = function() {
  var self   = this;
  var args   = Array.prototype.slice.call(arguments);
  var socket = net.connect.apply(this, args);

  self.log.info('Entering network through seed:', socket.address());

  // track in outbound connections
  self.connections.outbound.push(socket);

  // fire all middleware _connect() implementations
  socket.on('connect', function() {
    self._initMiddlewareConnect(socket);
    self._process(socket);
  });

  // cleanup after losing outbound connection
  socket.on('end', function() {
    self._cleanup(socket);
  });

  return socket;
};

Application.prototype.close = function(callback) {
  return this.server.close(callback);
};

Application.prototype.peers = function(iterator) {
  var everyone = [].concat(
    this.connections.inbound
  ).concat(
    this.connections.outbound
  );

  if (typeof iterator === 'function') everyone.forEach(iterator);

  return everyone;
};

Application.prototype._enterNetwork = function() {
  var self   = this;
  var active = self.connections.outbound.filter(function(c) {
    return !c.connecting;
  }).length;

  if (self.options.maxPeers <= active) return; // we have enough active seeds
  if (self.options.minPeers <= active) return; // we have enough active seeds

  self.options.seeds.forEach(function(seed) {
    var host = seed.split(':')[0];
    var port = seed.split(':')[1];

    for (var a = 0; a < active; a++) {
      var addr = active[a].address();
      if (host === addr.address && port === addr.port) return;
    }

    self.connect(port, host);
  });
};

Application.prototype._process = function(socket) {
  var self  = this;
  var stack = self.input();

  self.log.info('Processing socket ', socket.address());

  // reference the socket from each middleware
  stack.forEach(function(ware, index) {
    if (!ware.socket) {
      Object.defineProperty(ware, 'socket', { value: socket });
    }
  });

  socket.pipe(stack[0]);

  return stack[stack.length - 1];
};

Application.prototype._initMiddlewareConnect = function(socket) {
  this.stack.forEach(function(ware) {
    if (typeof ware._connect === 'function') ware._connect(socket);
  });
};

Application.prototype._cleanup = function(socket) {
  [
    self.connections.inbound,
    self.connections.outbound
  ].forEach(function(list) {
    list.forEach(function(sock, i) {
      if (sock === socket) {
        list.splice(i, 1);
      }
    });
  });
};

Application.prototype._read = function() {
  // noop
};

Application.prototype._write = function(chunk, encoding, callback) {
  // send outgoing messages
  this.push(chunk);
  callback();
};

Application.prototype._handleInbound = function(socket) {
  var self   = this;
  var remote = socket.address().address + ':' + socket.address().port;

  // handle incoming connection sockets
  self.log.info('Handling inbound connection from ' + remote);

  // cleanup after losing inbound connection
  socket.on('end', function() {
    self._cleanup(socket);
  });

  self.connections.inbound.push(socket);

  self._initMiddlewareConnect(socket);
  self._process(socket);
};

module.exports = Application;
