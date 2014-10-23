var async   = require('async');
var stream  = require('stream');
var util    = require('util');
var net     = require('net');
var merge   = require('merge');
var through = require('through');
var hat     = require('hat');

// default options
var DEFAULTS = {
  relayMessages: true,
  minPeers: 3,
  maxPeers: 12,
  seeds: [],
  logger: console
};

function Application(options) {
  stream.Duplex.call(this, { objectMode: true });

  this.id          = hat();
  this.server      = net.createServer(this._handleInbound.bind(this));
  this.stack       = [through(function(data) { this.queue(data) })];
  this.options     = merge(DEFAULTS, options);
  this.connections = { inbound: [], outbound: [] };

  // setup logger
  Object.defineProperty(this, 'log', { value: this.options.logger });
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
    if (typeof ware._init === 'function') ware._init(self)
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
  // this.input().pipe(this);
  this.log.info('Starting server on port ' + args[0]);
  return this.server.listen.apply(this.server, args);
};

Application.prototype.connect = function() {
  var self   = this;
  var args   = Array.prototype.slice.call(arguments);
  var socket = net.connect.apply(this, args);

  // track in outbound connections
  self.connections.outbound.push(socket);

  // fire all middleware _connect() implementations
  socket.on('connect', function() {
    self._initMiddlewareConnect(socket);
    // self._process(socket);
  });

  // cleanup after losing outbound connection
  socket.on('end', function() {
    self._cleanup(socket);
  });

  self.pipe(socket);

  // setup relay
  self._setupRelay(socket);

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

Application.prototype._process = function(socket) {
  var self  = this;
  var stack = self.input();

  self.log.info('Processing socket ', socket.address());

  // reference the socket from each middleware
  stack.forEach(function(ware, index) {
    Object.defineProperty(ware, 'socket', { value: socket });
    Object.defineProperty(ware, 'application', { value: self });
  });

  socket.pipe(stack[0]);
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

Application.prototype._setupRelay = function(inSock) {
  var self = this;
  // if relaying messages, then pipe inbound to outbound
  if (self.options.relayMessages) {
    self.connections.outbound.forEach(function(outSock) {
      var inbound  = JSON.stringify(inSock.address());
      var outbound = JSON.stringify(outSock.address());

      if (inbound === outbound) {
        return self.log.warn('Refusing to relay messages to same address');
      }

      inSock.pipe(outSock);
    });
  }
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

  self._initMiddlewareConnect(socket);
  self.connections.inbound.push(socket);
  self._process(socket);
};

module.exports = Application;
