var should  = require('should');
var sinon   = require('sinon');
var coal    = require('..');
var net     = require('net');
var stream  = require('stream');
var through = require('through');

var stublog = {
  info: sinon.stub(), warn: sinon.stub(), error: sinon.stub()
};

before(function(done) {
  done();
});

after(function(done) {
  done();
});

describe('Application', function() {

  var app1, app2, app3;

  describe('@constructor', function() {

    it('should create a proper instance', function(done) {
      app1 = coal({ logger: stublog });
      app1.server.should.be.instanceOf(net.Server);
      app1.stack.should.have.lengthOf(1);
      should.exist(app1.pipe);
      should.exist(app1.write);
      should.exist(app1.pipe);
      done();
    });

  });

  describe('#use', function() {

    it('should register the middleware', function(done) {
      var middleware = function(socket) {
        socket._processed = true;
        return through(function(data) { this.queue(data); });
      };

      middleware._plugin = function(app) {
        app.beep = 'boop';
      };

      app1.use(middleware);
      app1.stack.should.have.lengthOf(2);
      done();
    });

    it('should apply the _plugin on registration', function(done) {
      app1.beep.should.equal('boop');
      done();
    });

  });

  describe('#set', function() {

    it('should set the value to the key and return it', function(done) {
      app1.set('beep', 'boop');
      app1.options.beep.should.equal('boop');
      done();
    });

  });

  describe('#get', function() {

    it('return the non-null value', function(done) {
      app1.get('beep').should.equal('boop');
      done();
    });

    it('return null for non-existent key', function(done) {
      var check = app1.get('boop');
      should.not.exist(check);
      done();
    });

  });

  describe('#listen', function() {

    it('should begin accepting connections on the port', function(done) {
      app1.listen(1337, function() {
        var sock = net.connect(1337, function() {
          sock._connecting.should.equal(false);
          done();
        });
      });
    });

  });

  describe('#connect', function() {

    it('should open a connection to the target', function(done) {
      app2 = coal({ logger: stublog });
      var conn = app2.connect(1337, function() {
        conn._connecting.should.equal(false);
        done();
      });
    });

  });

  describe('#peers', function() {

    it('should return an array of all peers', function(done) {
      var peers = app1.peers();
      peers.should.have.lengthOf(2);
      done();
    });

    it('should call the function for each peer', function(done) {
      var total  = app1.peers().length;
      var called = 0;
      app1.peers(function(p) {
        if (p instanceof net.Socket) called++;
      });
      should(total).equal(called);
      done();
    });

  });

  describe('#_enterNetwork', function() {

    it('should open connections to supplied seeds', function(done) {
      app2.listen(1338, function() {
        app3 = coal({
          logger: stublog,
          seeds: ['127.0.0.1:1337','127.0.0.1:1338']
        });
        app3.connections.outbound.should.have.lengthOf(2);
        done();
      });
    });

  });

  describe('#_process', function() {

    it('should pipe the given socket through the stack', function(done) {
      app1.peers(function(p) {
        should.exist(p._processed);
      });
      done();
    });

  });

  describe('#_initMiddlewareStack', function() {

    it('should return a new instance of the stack', function(done) {
      var sock  = new net.Socket();
      var stack = app1._initMiddlewareStack(sock);
      stack.should.have.lengthOf(app1.stack.length);
      stack.should.not.equal(app1.stack);
      should.exist(sock._processed);
      done();
    });

  });

  describe('#_cleanup', function() {

    it('should remove the socket from the peer list', function(done) {
      var sock = new net.Socket();
      var len  = app1.connections.inbound.length;
      app1.connections.inbound.push(sock);
      app1.connections.inbound.should.lengthOf(len + 1);
      app1._cleanup(sock);
      app1.connections.inbound.should.lengthOf(len);
      done();
    });

  });

  describe('#_handleInbound', function() {

    it('should add the socket to the inbound peer list', function(done) {
      var sock = new net.Socket();
      var len  = app2.connections.inbound.length;
      app2._handleInbound(sock);
      app2.connections.inbound.should.have.lengthOf(len + 1);
      done();
    });

  });

});
