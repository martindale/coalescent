var should = require('should');
var sinon  = require('sinon');
var coal   = require('..');
var net    = require('net');
var async  = require('async');

var stublog = {
  info: sinon.stub(), warn: sinon.stub(), error: sinon.stub()
};

before(function(done) {
  done();
});

after(function(done) {
  done();
});

describe('Integration', function() {

  describe('Simple', function() {

    var app = coal({ logger: stublog });

    it('should send a message and have it recevied', function(done) {
      app.once('data', function(data) {
        data.toString().should.equal('beep boop\n');
        done();
      }).listen(2337);

      net.connect(2337).write('beep boop\n');
    });

  });

  describe('Relay', function() {

    var app1 = coal({ logger: stublog });
    var app2 = coal({ logger: stublog });
    var app3 = coal({ logger: stublog });

    app2.use(coal.tattletale());

    it('should setup the mock network', function(done) {
      async.waterfall([
        app1.listen.bind(app1, 2338),
        app2.listen.bind(app2, 2339),
        app3.listen.bind(app3, 2340),
        app1.connect.bind(app1, 2339),
        app2.connect.bind(app2, 2340)
      ], done);
    });

    it('should relay inbound message to outbound peer', function(done) {
      app3.once('data', function(d) {
        d.toString().should.equal('beep boop\n');
        done();
      });
      app1.write('beep boop\n');
    });

    it('should relay outbound peer message to inbound', function(done) {
      app1.once('data', function(d) {
        d.toString().should.equal('beep boop\n');
        done();
      });
      app3.write('beep boop\n');
    });

  });

  describe('Smart Relay', function () {
    var app1, app2, app3;
    var port1 = 3455;
    var port2 = 3555;
    var port3 = 3655;

    beforeEach(function (done) {
      var bCoal = coal.bind(coal, { logger: stublog });
      app1 = bCoal();
      app2 = bCoal();
      app3 = bCoal();

      app1.use(coal.smartrelay());
      app2.use(coal.smartrelay());
      app3.use(coal.smartrelay());

      async.waterfall([
        app1.listen.bind(app1, ++port1),
        app2.listen.bind(app2, ++port2),
        app3.listen.bind(app3, ++port3),
        app1.connect.bind(app1, port2),
        app2.connect.bind(app2, port3),
        app3.connect.bind(app3, port1)
      ], done);
    });

    it('should relay messages to peers', function (done) {
      app3.once('data', function (data) {
        data.toString().should.equal('beep boop\n');
        done();
      });
      app1.write('beep boop\n');
    });

    it('should not relay duplicate messages', function (done) {
      var timesReceived = 0;
      var calledDone;
      app1.on('data', function (data) {
        data.toString().should.equal('beep boop\n');
        timesReceived++;

        setTimeout(function () {
          // app1 should receive the message 3 times
          // this means each node tried to relay the message and then stopped
          // when the duplicate first was received, meaning each node processed
          // the message only once itself
          timesReceived.should.equal(3);

          if (!calledDone) {
            calledDone = true;
            done();
          }
        }, 10); // allow time to see if nodes are oversharing
      });
      app3.write('beep boop\n');
    });
  });

  describe('Routing', function() {

    var app = coal({ logger: stublog });

    app.use(coal.courier());
    app.use(coal.router());
    app.listen(2341);

    it('should call the handler for the message type', function(done) {
      app.route('ping', function(socket, message) {
        message.type.should.equal('ping');
        done();
      });

      net.connect(2341).write(JSON.stringify({
        type: 'ping',
        body: { time: Date.now() }
      }) + '\n');
    });

    it('should call the default handler for unknown', function(done) {
      app.route('*', function(socket, message) {
        message.type.should.equal('pong');
        done();
      });

      net.connect(2341).write(JSON.stringify({
        type: 'pong',
        body: { time: Date.now() }
      }) + '\n');
    });

  });

  describe('Messages', function() {

    var app = coal({ logger: stublog });

    app.use(coal.courier());
    app.listen(2342);

    it('should parse the message into an object', function(done) {
      app.on('data', function(data) {
        data.type.should.equal('ping');
        done();
      });

      net.connect(2342).write(JSON.stringify({
        type: 'ping', body: Date.now()
      }) + '\n');
    });

  });

  describe('Broadcasting', function() {

    var app1 = coal({ logger: stublog });
    var app2 = coal({ logger: stublog });
    var app3 = coal({ logger: stublog });

    app1.use(coal.courier());
    app2.use(coal.courier());
    app3.use(coal.courier());

    it('should setup the mock network', function(done) {
      async.waterfall([
        app1.listen.bind(app1, 2343),
        app2.listen.bind(app2, 2344),
        app3.listen.bind(app3, 2345),
        app1.connect.bind(app1, 2344),
        app2.connect.bind(app2, 2345),
      ], done);
    });

    it('should broadcast the message to all peers', function(done) {
      var recd = 0;

      app1.once('data', function(d) { if (cond(d) && ++recd === 2) done() });
      app3.once('data', function(d) { if (cond(d) && ++recd === 2) done() });

      function cond(data) {
        data.type.should.equal('ping');
        data.body.message.should.equal('Greetings from app2!');
        return true;
      };

      app2.broadcast('ping', { message: 'Greetings from app2!' });
    });

  });

});
