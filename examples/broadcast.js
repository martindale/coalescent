var async    = require('async');
var es       = require('event-stream');
var coalesce = require('..');
var app1     = coalesce();
var app2     = coalesce();
var app3     = coalesce();

// use courier middleware
app1.use(coalesce.courier());
app2.use(coalesce.courier());
app3.use(coalesce.courier());

// pipe output to console
// app1.pipe(es.stringify()).pipe(process.stdout);
// app3.pipe(es.stringify()).pipe(process.stdout);

app1.on('data', function(d) { console.log('app1', d) })
app3.on('data', function(d) { console.log('app3', d) })

async.waterfall(
  [
    // spin up three servers
    app1.listen.bind(app1, 1337),
    app2.listen.bind(app2, 1338),
    app3.listen.bind(app3, 1339),
    // connect to app2 from app1
    function(done) {
      app1.connect(1338, done);
    },
    // connect to app3 from app2
    function(done) {
      app2.connect(1339, done);
    }
  ],
  function() {
    // app3 receives relayed messages from app1
    setInterval(function() {
      app2.broadcast('ping', { message: 'Greetings from app2!' });
    }, 500);
  }
);
