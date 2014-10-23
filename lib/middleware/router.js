var stream = require('stream');
var util   = require('util');

function Router(opts) {
  stream.Transform.call(this, { objectMode: true });

  opts = opts || {};


};

util.inherits(Router, stream.Transform);

Router.prototype._transform = function(data, encoding, callback) {
  var self = this;


};

module.exports = function(options) {

};
