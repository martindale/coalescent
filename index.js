var Application = require('./lib/application');
var courier     = require('./lib/middleware/courier');
var router      = require('./lib/middleware/router');
var tattletale  = require('./lib/middleware/tattletale');
var smartrelay  = require('./lib/middleware/smartrelay');

// expose app constructor
function coalescent(opts) {
  return new Application(opts);
};

// expose middleware
coalescent.courier    = courier;
coalescent.router     = router;
coalescent.tattletale = tattletale;
coalescent.smartrelay = smartrelay;

// expose module
module.exports = coalescent;
