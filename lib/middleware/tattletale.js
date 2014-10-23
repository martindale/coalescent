var stream = require('stream');
var util   = require('util');

function Tattletale(opts) {
  stream.Transform.call(this, {  });

  opts = opts || {};

};

util.inherits(Tattletale, stream.Transform);

Tattletale.prototype._transform = function(data, encoding, callback) {
  var self = this;

  // pass data through - no manipulation

  this.push(data);
  callback();
};

Tattletale.prototype._init = function(app) {
  var self = this;

  // wire up connection to peer list
};

Tattletale.prototype._connect = function(socket) {
  var self = this;

  // setup reference to new sockets
};

module.exports = function(options) {
  return new Tattletale(options);
};
