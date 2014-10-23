Coalescent
==========

An [Express](http://expressjs.com/)-like framework for rapidly building
[P2P](http://en.wikipedia.org/wiki/Peer-to-peer) applications with Node.js.

[![Build Status](https://travis-ci.org/gordonwritescode/coalescent.svg)](https://travis-ci.org/gordonwritescode/coalescent)

## Getting Started

Install Coalescent using NPM:

```
$ npm install coalescent
```

Build your P2P application:

```js
var coalescent = require('coalescent');
var app        = coalescent();

// transform streams as middleware
app.use(coalescent.courier()); // parse incoming messages
app.use(coalescent.router()); // route parsed messages to handlers

// handle errors
app.on('error', function(err, socket) {
  console.log(err);
});

// configure app
app.set('seeds', ['somehost:1337']);
app.set('maxPeers', 12);
app.set('relayMessages', true);

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

You can use the `coalescent.router()` middleware to setup express-like message
handlers.

```js
// call this after courier()
app.use(coalescent.router());

// when we get a `ping` message, send 'pong'
app.route('ping', function(socket) {
  // you can write() to the socket or use the send()
  // method provided by the courier middleware
  socket.send('pong', { timestamp: Date.now() });
});
```
