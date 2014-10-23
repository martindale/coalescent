var net      = require('net');
var es       = require('event-stream');
var coalesce = require('..');
var app      = coalesce();

app.use(coalesce.courier());

// the courier middleware puts `app` into objectMode
app.on('data', function(data) {
  console.log(data);
});

// start server
app.listen(1337);

// connect to server
var sock = net.connect(1337);

// send messages
setInterval(function() {
  sock.write(JSON.stringify({ type: 'ping', body: Date.now() }) + '\n');
}, 500);
