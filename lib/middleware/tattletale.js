var stream = require('stream');
var util   = require('util');

function Tattletale(socket, opts) {
  stream.Transform.call(this, {  });

  opts = opts || {};

  this.socket = socket;
  this.peers  = function() { return [] };
};

util.inherits(Tattletale, stream.Transform);

Tattletale.prototype._transform = function(data, encoding, callback) {
  var self = this;

  self.peers().forEach(function(peer) {
    if (peer !== self.socket) peer.write(data);
  });

  this.push(data);
  callback();
};

Tattletale.prototype._init = function(app) {
  var self = this;

  // wire up connection to peer list
  self.peers = app.peers.bind(app);
};

module.exports = function(options) {
  return function(socket) {
    return new Tattletale(socket, options);
  };
};
