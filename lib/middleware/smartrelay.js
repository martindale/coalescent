/**
* @module coalescent/middleware/smartrelay
*/

'use strict';

var stream = require('stream');
var merge = require('merge');
var util   = require('util');
var crypto = require('crypto');

util.inherits(SmartRelay, stream.Transform);

SmartRelay.DEFAULTS = {

};

/**
* Smarter implementation of a gossip protocol
* @constructor
* @param {object} socket
* @param {object} options
*/
function SmartRelay(socket, options) {
  stream.Transform.call(this, {});

  this.options = merge(Object.create(SmartRelay.DEFAULTS), options || {});
  this.socket = socket;
  this.recentData = [];

  this.peers = function () {
    return [];
  };
}

/**
* Transform stream implementation to relay messages to other peers
* #_transform
* @see https://iojs.org/api/stream.html#stream_class_stream_transform_1
*/
SmartRelay.prototype._transform = function (data, encoding, callback) {
  var self = this;
  // create a unique hash of the incoming data
  var dataHash = crypto.createHash('sha1').update(data).digest('hex');
  // this should help the hash list scale well enough to match the potential
  // volume of data incoming from peers
  // a very talkative peer may pose a problem
  var recent = self.recentData;
  var maxHashes = self.peers().length * 3;
  var sliceEnd = maxHashes > recent.length ? recent.length + 1 : maxHashes;

  if (self.recentData.indexOf(dataHash) === -1) {
    self.recentData.unshift(dataHash);
    self.recentData = this.recentData.slice(0, sliceEnd);

    self.peers().forEach(function (peer) {
      if (peer !== self.socket) {
        peer.write(data);
      }
    });
  }

  callback(null, data);
};

/**
* Reference defined application peers
* #_init
* @see README.md
*/
SmartRelay.prototype._init = function (app, socket) {
  this.peers = app.peers.bind(app);
};

/**
* Export middleware
* #exports
*/
module.exports = function(options) {
  return function (socket) {
    return new SmartRelay(socket, options);
  };
};
