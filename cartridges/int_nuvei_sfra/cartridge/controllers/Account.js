'use strict';

/**
 * @namespace Account
 */

var server = require('server');
var userLoggedIn = require('*/cartridge/scripts/middleware/userLoggedIn');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');

server.extend(module.superModule);

server.prepend('Show', server.middleware.https, userLoggedIn.validateLoggedIn, consentTracking.consent, function (req, res, next) {
    require('*/cartridge/scripts/updateSavedCards').updateSavedCards({
        CurrentCustomer: req.currentCustomer.raw
    });

    next();
});

module.exports = server.exports();
