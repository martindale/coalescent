var net      = require('net');
var coalesce = require('..');
var app      = coalesce();

// pipe incoming to console
app.pipe(process.stdout);

// start server
app.listen(1337);

// connect to server
var sock = net.connect(1337);

// send messages
setInterval(function() {
  sock.write('beep boop\n');
}, 500);
