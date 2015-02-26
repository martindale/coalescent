/**
* @module coalescent/middleware/router
*/

var stream = require('stream');
var merge = require('merge');
var util = require('util');

util.inherits(Router, stream.Transform);

Router.DEFAULTS = {

};

/**
* Routes messages parsed with courier to defined handlers by `type`
* @constructor
* @param {object} socket
* @param {object} options
*/
function Router(socket, options) {
  stream.Transform.call(this, { objectMode: true });

  this.options = merge(Object.create(Router.DEFAULTS), options || {});
  this.socket = socket;
};

/**
* Transform stream implementation to pass data through and call handler
* #_transform
* @see https://iojs.org/api/stream.html#stream_class_stream_transform_1
*/
Router.prototype._transform = function(message, encoding, callback) {
  var self = this;
  var type = message.type
  var handler = self._routes[type] || self._routes['*'];

  handler(self.socket, message);

  this.push(message);
  callback();
};

/**
* Reference defined handlers on `app`
* #_init
* @see README.md
*/
Router.prototype._init = function(app, socket) {
  var self = this;

  self._routes = app._routes;
};

/**
* Export middleware, add `_plugin` for implementing `app.route()`
* #exports
*/
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
