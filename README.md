Coalescent
==========

An [Express](http://expressjs.com/)-like framework for rapidly building
[P2P](http://en.wikipedia.org/wiki/Peer-to-peer) applications with Node.js.

[![Build Status](https://travis-ci.org/gordonwritescode/coalescent.svg)](https://travis-ci.org/gordonwritescode/coalescent)

## Getting Started

Install Coalescent using NPM:

```
npm install coalescent
```

Build your P2P application:

```js
var coalescent = require('coalescent');
var app        = coalescent();

// transform streams as middleware
app.use(coalescent.tattletale()); // relay received messages to other peers
app.use(coalescent.courier()); // parse incoming messages
app.use(coalescent.router()); // route parsed messages to handlers

// handle errors
app.on('error', function(err, socket) {
  console.log(err);
});

app.listen(1337, function() {
  console.log('node accepting connections on port 1337');
});
```

The `app` object is a duplex stream. Connected peers get whatever you write to
it. You will get whatever your peers write to you when reading from it.

```js
// print incoming messages to console
app.pipe(process.stdout);

// broadcast message to peers
app.write('beep boop\n');

// using the courier middleware, we can use broadcast()
app.broadcast('beep', { sound: 'boop' });

// maybe even stream a file to all your peers
fs.createReadStream('not_copyright_infringing.mp4').pipe(app);
```

## Options

The `coalescent()` function takes an optional `options` argument to configure
its behavior. This should be an object with the following properties:

### minPeers

The minimum number of seeds we should actively attempt to reach. Defaults to `3`.

### maxPeers

The maximum number of seeds we should attempt to reach. Defaults to `12`.

### seeds

An array of seeds to connect in the format `'host:port'`. Defaults to `[]`.

### logger

Any object that implements `info`, `error`, and `warn` methods. Defaults to
`console`.

## Events

### peerConnected

Emitted when a new peer (either inbound or outbound) is connected. Passes peer
socket object to handler.

### peerDisconnected

Emitted when an existing peer (either inbound or outbound) is disconnected.
Passes peer socket object to handler.

### error

Emitted when an error occurs. Passes the error object to handler.

## Middleware and Plugins

Coalescent aims to provide an un-opinionated framework, letting you build atop
via middleware and plugins.

Register your middleware using the `use()` method.

```js
app.use(middleware);
```

There is only one rule and that is the object you pass to `use()` must be a
function that returns an object that inherits from `stream.Transform`.

Middleware works by creating a "chain of pipes". Input your app receives will
get piped through the middleware stack before becoming your application output.

This is very easy using a module like [through](https://www.npmjs.org/package/through).

```js
// replace "beep" with "boop"
app.use(function(socket) {
  return through(function(data) {
    var transformed = data.split('beep').join('boop');
    // pass on to next middleware
    this.queue(transformed);
    // access the connected socket, too!
    console.log('Received message from', socket.address());
  });
);
```

Your middleware function gets called with `socket`, which is the "current"
`net.Socket` instance.

### Included Middleware

Coalescent ships with three pieces of middleware for common use-cases.

#### Tattletale

The Tattletale middleware will automatically relay received messages to your
other peers. This should provide a good start for implementing a Gossip protocol
for network-wide data replication.

```js
app.use(coalescent.tattletale());
```

#### Courier

The Courier middleware handles parsing incoming messages into objects that can
be handled by your application as well as supplementing connected `Sockets` with
a `send()` method and your application with a `broadcast()` method.

Both `send()` and `broadcast()` take a `type` parameter as their first argument
and a `data` parameter as the second.

```js
app.broadcast('ping', { time: Date.now() });
```

#### Router

The Router middleware can be used to setup express-like message handlers based
on the `type` parameter of messages parsed with Courier.

```js
// call this after courier()
app.use(coalescent.router());

// when we get a `ping` message, send 'pong'
app.route('ping', function(socket, message) {
  // you can write() to the socket or use the send()
  // method provided by the courier middleware
  socket.send('pong', { time: Date.now() });
});
```

### Methods for Implementors

There are two methods that your middleware can implement to affect the
behavior of your application:

#### _transform(data, encoding, done)

The required method for `stream.Transform` instances.

#### _init(app, socket)

Gets called every time a new peer connects with a reference to the application,
and the new connected socket.

## Application Plugins

Implementing a `_plugin(app)` function that extends from your middleware
**function**, will get called upon initial registration of your middleware.
This lets you modify or embellish the `app` object.

Example:

```js
module.exports = function middleware() {
  var tform = new stream.Transform();
  // ...
  return tform;
};

module.exports._plugin = function(app) {
  // do stuff with `app`
};
```
