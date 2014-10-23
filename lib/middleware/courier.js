var stream = require('stream');
var util   = require('util');
var es     = require('event-stream');

// middleware constructor
function Courier(opts) {
  stream.Transform.call(this, { objectMode: true });

  opts = opts || {};

  this.typeParam  = opts.typeParam || 'type';
  this.bodyParam  = opts.bodyParam || 'body';
  this.terminator = opts.terminator || '\n';
};

util.inherits(Courier, stream.Transform);

Courier.prototype._transform = function(data, encoding, callback) {
  var self = this;
  // add send() method to socket, if it doesn't exist
  if (typeof self.socket.send !== 'function') {
    self.socket.send = (function(type, body) {
      var data = {};
      // use configured params
      data[self.typeParam] = type;
      data[self.bodyParam] = body;
      // create message and convert to string
      var message = self.message(data).toString();
      // write message to socket
      this.write(message);
    }).bind(self.socket);
  }

  // pass along the message down the stack
  self.push(self.message(data));
  callback();
};

Courier.prototype.message = function(obj) {
  var self    = this;
  var message = {};

  message.type = obj[this.typeParam] || null;
  message.body = obj[this.bodyParam] || {};

  Object.defineProperty(message, '_raw', {
    value: JSON.stringify(obj),
    enumerable: false
  });

  Object.defineProperty(message, 'toString', {
    value: function() {
      return JSON.stringify(message._raw) + self.terminator;
    },
    enumerable: false
  });

  return message;
};

module.exports = function(options) {
  options = options || {};

  var split   = es.split(options.terminator);
  var parse   = es.parse();
  var courier = new Courier(options);

  return [split, parse, courier];
};
