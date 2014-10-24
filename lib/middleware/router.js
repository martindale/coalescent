var stream = require('stream');
var util   = require('util');

function Router(socket, opts) {
  stream.Transform.call(this, { objectMode: true });

  opts = opts || {};

  this.socket = socket;
};

util.inherits(Router, stream.Transform);

Router.prototype._transform = function(message, encoding, callback) {
  var self    = this;
  var type    = message.type
  var handler = self._routes[type] || self._routes['*'];

  handler(self.socket, message);

  this.push(message);
  callback();
};

Router.prototype._init = function(app, socket) {
  var self = this;

  self._routes = app._routes;
};

module.exports = function(options) {
  var middleware = function(socket) {
    return new Router(socket, options);
  };

  middleware._plugin = function(app) {
    app._routes = { '*': new Function() };

    app.route = app.route || function(match, handler) {
      this._routes[match] = handler;
    };
  };

  return middleware;
};
