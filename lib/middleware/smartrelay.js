var stream = require('stream');
var util   = require('util');
var crypto = require('crypto');

function SmartRelay(socket) {
  stream.Transform.call(this, {});

  this.socket = socket;
  this.recentData = [];
  this.peers = function () { return [] };
};

util.inherits(SmartRelay, stream.Transform);

SmartRelay.prototype._transform = function (data, encoding, callback) {
  var _this = this;
  // create a unique hash of the incoming data
  var dataHash = crypto.createHash('sha1').update(data).digest('hex');
  // this should help the hash list scale well enough to match the potential
  // volume of data incoming from peers
  // a very talkative peer may pose a problem
  var maxHashes = this.peers().length * 3
  var sliceEnd = maxHashes > this.recentData.length
    ? this.recentData.length + 1
    : maxHashes;

  if (this.recentData.indexOf(dataHash) === -1) {
    this.recentData.unshift(dataHash);
    this.recentData = this.recentData.slice(0, sliceEnd);

    this.peers().forEach(function (peer) {
      if (peer !== _this.socket) peer.write(data);
    });
  }

  callback(null, data);
};

SmartRelay.prototype._init = function (app, socket) {
  // wire up connection to peer list
  this.peers = app.peers.bind(app);
};

module.exports = function () {
  return function (socket) {
    return new SmartRelay(socket);
  };
};
