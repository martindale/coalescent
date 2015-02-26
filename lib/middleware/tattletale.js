/**
* @module coalescent/middleware/tattletale
*/

var stream = require('stream');
var merge = require('merge');
var util = require('util');

util.inherits(Tattletale, stream.Transform);

Tattletale.DEFAULTS = {

};

/**
* Simple (naive) implementation of a gossip protocol
* @constructor
* @param {object} socket
* @param {object} options
*/
function Tattletale(socket, opts) {
  stream.Transform.call(this, {  });

  this.options = merge(Object.create(Tattletale.DEFAULTS), opts || {});
  this.socket = socket;

  this.peers = function() {
    return []
  };
};

/**
* Transform stream implementation to relay messages to other peers
* #_transform
* @see https://iojs.org/api/stream.html#stream_class_stream_transform_1
*/
Tattletale.prototype._transform = function(data, encoding, callback) {
  var self = this;

  self.peers().forEach(function(peer) {
    if (peer !== self.socket) {
      peer.write(data);
    }
  });

  this.push(data);
  callback();
};

/**
* Reference defined application peers
* #_init
* @see README.md
*/
Tattletale.prototype._init = function(app, socket) {
  this.peers = app.peers.bind(app);
};

/**
* Export middleware
* #exports
*/
module.exports = function(options) {
  return function(socket) {
    return new Tattletale(socket, options);
  };
};
