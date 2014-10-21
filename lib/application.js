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
  stream.Duplex.call(this);

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
  if (!middleware._transform || !middleware.pipe) {
    throw new TypeError('Middleware does not inherit from stream.Transform');
  }

  // register the tranform stream in the stack
  this.input.pipe(middleware);
  this.stack.push(middleware);

  return this;
};

Application.prototype.input = function() {
  return this.stack.slice(-1).pop();
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
  this.input().pipe(this);
  this.log.info('Starting server on port ' + args[0]);
  return this.server.listen.apply(this.server, args);
};

Application.prototype.connect = function() {
  var self   = this;
  var args   = Array.prototype.slice.call(arguments);
  var socket = net.connect.apply(this, args);

  // track in outbound connections
  self.connections.outbound.push(socket);

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

  self.connections.inbound.push(socket);
  socket.pipe(self.stack[0]);
};

module.exports = Application;
