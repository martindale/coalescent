var stream = require('stream');
var util   = require('util');

function Router(opts) {
  stream.Transform.call(this, { objectMode: true });

  opts = opts || {};

  this.routes = { '*': new Function() };
};

util.inherits(Router, stream.Transform);

Router.prototype._transform = function(message, encoding, callback) {
  var self    = this;
  var type    = message.type
  var handler = self.routes[type] || self.routes['*'];

  handler(self.socket, message);

  this.push(message);
  callback();
};

Router.prototype._init = function(app) {
  var self = this;

  app.route = function(match, handler) {
    self.routes[match] = handler;
  };
};

module.exports = function(options) {
  return new Router(options);
};
