'use strict';

/**
 * @namespace PaymentInstruments
 */

var server = require('server');

var userLoggedIn = require('*/cartridge/scripts/middleware/userLoggedIn');
var Resource = require('dw/web/Resource');

server.extend(module.superModule);

/**
 * PaymentInstruments-DeletePayment : The PaymentInstruments-DeletePayment is the endpoint responsible for deleting a shopper's saved payment instrument from their account
 * @name Base/PaymentInstruments-DeletePayment
 * @function
 * @memberof PaymentInstruments
 * @param {middleware} - userLoggedIn.validateLoggedInAjax
 * @param {querystringparameter} - UUID - the universally unique identifier of the payment instrument to be removed from the shopper's account
 * @param {category} - sensitive
 * @param {returns} - json
 * @param {serverfunction} - get
 */
server.append('DeletePayment', userLoggedIn.validateLoggedInAjax, function (req, res, next) {
    var viewData = res.getViewData();

    var removeResult = require('*/cartridge/scripts/removeSavedCard').removeSavedCard({
        CurrentCustomer: req.currentCustomer.raw,
        PaymentToDelete: viewData.raw
    });

    if (!removeResult.error) {
        viewData.message = Resource.msg('msg.deleted.success', 'creditCard', '');
        res.setViewData(viewData);
    }

    return next();
});


module.exports = server.exports();
