var Application = require('./lib/application');
var courier     = require('./lib/middleware/courier');
var router      = require('./lib/middleware/router');

// expose app constructor
function coalesce(opts) {
  return new Application(opts);
};

// expose middleware
coalesce.courier = courier;
coalesce.router  = router;

// expose module
module.exports = coalesce;
