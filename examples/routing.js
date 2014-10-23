var net      = require('net');
var coalesce = require('..');
var app      = coalesce();

app.use(coalesce.courier());
app.use(coalesce.router());

app.route('ping', function(socket, message) {
  console.log('Handling message:', message);
  socket.send('pong', { time: Date.now() });
});

// start server
app.listen(1337);

// connect to server
var sock = net.connect(1337);

sock.on('data', function(data) {
  console.log('Received message:', JSON.parse(data));
});

// send messages
setInterval(function() {
  sock.write(JSON.stringify({
    type: 'ping',
    body: { time: Date.now() }
  }) + '\n');
}, 500);
