/**
* @module coalescent/middleware/courier
*/

var stream = require('stream');
var merge = require('merge');
var util = require('util');
var es = require('event-stream');

util.inherits(Courier, stream.Transform);

Courier.DEFAULTS = {
  typeParam: 'type',
  bodyParam: 'body',
  terminator: '\n'
};

/**
* JSON parsing middleware designed for easy message routing
* @constructor
* @param {object} options
*/
function Courier(opts) {
  stream.Transform.call(this, { objectMode: true });

  this.options = merge(Object.create(Courier.DEFAULTS), opts || {});
};

/**
* Create a message object from the given data
* #message
* @param {object} data
*/
Courier.prototype.message = function(obj) {
  var self = this;
  var message = {};

  if (typeof obj === 'string') {
    try {
      obj = JSON.parse(obj);
    } catch(err) {
      // noop
    }
  }

  message.type = obj[self.options.typeParam] || null;
  message.body = obj[self.options.bodyParam] || {};

  Object.defineProperty(message, '_raw', {
    value: JSON.stringify(obj),
    enumerable: false
  });

  Object.defineProperty(message, 'toString', {
    value: function() {
      return message._raw + self.options.terminator;
    },
    enumerable: false
  });

  return message;
};

/**
* Transform stream implementation to convert data to message object
* #_transform
* @see https://iojs.org/api/stream.html#stream_class_stream_transform_1
*/
Courier.prototype._transform = function(data, encoding, callback) {
  var self = this;
  // pass along the message down the stack
  self.push(self.message(data));
  callback();
};

/**
* Add `send` method to peers for automatic message serialization
* #_init
* @see README.md
*/
Courier.prototype._init = function(app, socket) {
  var self = this;

  socket.send = function(type, body) {
    var data = {};
    // use configured params
    data[self.options.typeParam] = type;
    data[self.options.bodyParam] = body;
    // create message and convert to string
    var message = self.message(data).toString();
    // write message to socket
    this.write(message);
  };
};

/**
* Export middleware array, add `_plugin` for implementing `app.broadcast()`
* #exports
*/
module.exports = function(options) {
  options = options || {};

  var courier = function(socket) {
    return new Courier(options);
  };

  courier._plugin = function(app) {
    app.broadcast = function(type, body) {
      app.peers(function(peer) {
        app.log.info('sending message to', peer.address())
        peer.send(type, body);
      });
    };
  };

  return [
    function(socket) {
      return es.split(options.terminator || Courier.DEFAULTS.terminator);
    },
    function(socket) {
      return es.parse();
    },
    courier
  ];
};
