'use strict';

var coalescent = require('./lib/application');

coalescent.courier = require('./lib/middleware/courier');
coalescent.router = require('./lib/middleware/router');
coalescent.tattletale = require('./lib/middleware/tattletale');
coalescent.smartrelay = require('./lib/middleware/smartrelay');

module.exports = coalescent;
