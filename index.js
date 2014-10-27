var Application = require('./lib/application');
var courier     = require('./lib/middleware/courier');
var router      = require('./lib/middleware/router');
var tattletale  = require('./lib/middleware/tattletale');

// expose app constructor
function coalescent(opts) {
  return new Application(opts);
};

// expose middleware
coalesce.courier    = courier;
coalesce.router     = router;
coalesce.tattletale = tattletale;

// expose module
module.exports = coalescent;
