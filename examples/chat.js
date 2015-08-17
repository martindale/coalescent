/*
* P2P Chat Example
*/

'use strict';

var program = require('commander');
var read = require('read');
var rl = require('readline');
var color = require('cli-color');
var coalescent = require('..');

program
  .version('0.0.0')
  .option('-s, --seeds <host:port,host:port...>', 'seeds for entering network')
  .option('-p, --port <port>', 'listen on port', 1337)
  .parse(process.argv);

var app = coalescent({
  seeds: program.seeds ? program.seeds.split() : [],
  logger: false
});

app.use(coalescent.tattletale());
app.use(coalescent.courier());
app.use(coalescent.router());

read({ prompt: 'Handle: ', default: 'Anonymous' }, function(err, handle) {

  var iface = rl.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  iface.on('line', function(data) {
    app.broadcast('chat', { handle: handle, text: data.toString() });
    iface.prompt(true);
  }).resume();

  app.route('chat', function(socket, message) {
    socket.handle = message.body.handle;
    console.log(color.bold(message.body.handle + ': ') + message.body.text);
    iface.prompt(true);
  });

  app.on('peerConnected', function(peer) {
    console.log(color.italic((peer.handle || 'Someone') + ' joined!'));
    iface.prompt(true);
  });

  app.on('peerDisconnected', function(peer) {
    console.log(color.italic((peer.handle || 'Someone') + ' left!'));
    iface.prompt(true);
  });

  console.log('Welcome! Type a message and press <return> to chat.\n');

  iface.prompt(true);

  app.listen(program.port);
});
