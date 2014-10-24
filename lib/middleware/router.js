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

  app._routes = self._routes = app._routes || { '*': new Function() };

  app.route = app.route || function(match, handler) {
    this._routes[match] = handler;
  };
};

module.exports = function(options) {
  return function(socket) {
    return new Router(socket, options);
  };
};
