var stream = require('stream');
var util   = require('util');
var es     = require('event-stream');

function Courier(opts) {
  stream.Transform.call(this, { objectMode: true });

  opts = opts || {};

  this.typeParam  = opts.typeParam || 'type';
  this.bodyParam  = opts.bodyParam || 'body';
  this.terminator = opts.terminator || '\n';
};

util.inherits(Courier, stream.Transform);

Courier.prototype.message = function(obj) {
  var self    = this;
  var message = {};

  if (typeof obj === 'string') {
    try {
      obj = JSON.parse(obj);
    }
    catch(err) {
      // noop
    }
  }

  message.type = obj[self.typeParam] || null;
  message.body = obj[self.bodyParam] || {};

  Object.defineProperty(message, '_raw', {
    value: JSON.stringify(obj),
    enumerable: false
  });

  Object.defineProperty(message, 'toString', {
    value: function() {
      return message._raw + self.terminator;
    },
    enumerable: false
  });

  return message;
};

Courier.prototype._transform = function(data, encoding, callback) {
  var self = this;
  // pass along the message down the stack
  self.push(self.message(data));
  callback();
};

Courier.prototype._connect = function(socket) {
  var self = this;

  socket.send = function(type, body) {
    var data = {};
    // use configured params
    data[self.typeParam] = type;
    data[self.bodyParam] = body;
    // create message and convert to string
    var message = self.message(data).toString();
    // write message to socket
    this.write(message);
  };
};

Courier.prototype._init = function(app) {
  var self = this;

  app.broadcast = function(type, body) {
    this.peers(function(peer) {
      console.log('sending message to', peer.address())
      peer.send(type, body);
    });
  };
};

module.exports = function(options) {
  options = options || {};

  var split   = es.split(options.terminator);
  var parse   = es.parse();
  var courier = new Courier(options);

  return [split, parse, courier];
};
