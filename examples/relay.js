var async    = require('async');
var coalesce = require('..');
var app1     = coalesce();
var app2     = coalesce();
var app3     = coalesce();

app2.use(coalesce.tattletale());

// pipe output to console
app3.pipe(process.stdout);

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
      app1.write('beep boop\n');
    }, 500);
  }
);
