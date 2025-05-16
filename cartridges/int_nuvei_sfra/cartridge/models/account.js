'use strict';

var parent = module.superModule;

var URLUtils = require('dw/web/URLUtils');

/**
 * Creates a plain object that contains payment instrument information
 * @param {Object} userPaymentInstruments - current customer's paymentInstruments
 * @returns {Object} object that contains info about the current customer's payment instruments
 */
function getCustomerPaymentInstruments(userPaymentInstruments) {
    var paymentInstruments;
    var paymentInstrumentList = (userPaymentInstruments instanceof dw.util.Collection) ? userPaymentInstruments.toArray() : userPaymentInstruments;

    paymentInstruments = paymentInstrumentList.map(function (paymentInstrument) {
        var ccToken = (paymentInstrument instanceof dw.order.PaymentInstrument) ? paymentInstrument.creditCardToken : paymentInstrument.raw.creditCardToken;

        var result = {
            creditCardHolder: paymentInstrument.creditCardHolder,
            maskedCreditCardNumber: paymentInstrument.maskedCreditCardNumber,
            creditCardType: paymentInstrument.creditCardType,
            creditCardExpirationMonth: paymentInstrument.creditCardExpirationMonth,
            creditCardExpirationYear: paymentInstrument.creditCardExpirationYear,
            token: ccToken,
            UUID: paymentInstrument.UUID
        };

        result.cardTypeImage = {
            src: URLUtils.staticURL('/images/' +
                paymentInstrument.creditCardType.toLowerCase().replace(/\s/g, '') +
                '-dark.svg'),
            alt: paymentInstrument.creditCardType
        };

        return result;
    });

    return paymentInstruments;
}

/**
 * Account class that represents the current customer's profile dashboard
 * @param {Object} currentCustomer - Current customer
 * @param {Object} addressModel - The current customer's preferred address
 * @param {Object} orderModel - The current customer's order history
 * @constructor
 */
function account(currentCustomer, addressModel, orderModel) {
    parent.call(this, currentCustomer, addressModel, orderModel);

    var customerProfile = (currentCustomer instanceof dw.customer.Customer) ? currentCustomer.profile : currentCustomer;
    var customerWalletPaymentInstruments = customerProfile.wallet && customerProfile.wallet.paymentInstruments;
    if (!customerWalletPaymentInstruments instanceof Array) {
        customerWalletPaymentInstruments = customerWalletPaymentInstruments.toArray();
    }

    this.customerPaymentInstruments = customerWalletPaymentInstruments && customerWalletPaymentInstruments.length
        ? getCustomerPaymentInstruments(customerWalletPaymentInstruments)
        : null;
}

account.getCustomerPaymentInstruments = getCustomerPaymentInstruments;

module.exports = account;
