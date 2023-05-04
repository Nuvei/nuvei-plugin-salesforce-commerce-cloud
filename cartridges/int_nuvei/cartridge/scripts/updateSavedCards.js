'use strict';

/**
 * Deletes expired payment instruments, syncs cards with Nuvei recurring payments card list
 *
 * @input CurrentCustomer : dw.customer.Customer
 */

/* API Includes */
const Logger = require('dw/system/Logger');
const PaymentInstrument = require('dw/order/PaymentInstrument');
const Transaction = require('dw/system/Transaction');

/**
 * Gets Customer's stored payment methods and filters Credit Cards
 *
 * @param {dw.customer.Customer} customer - current Customer
 * @returns {Array} Stored Credit Cards
 */
function getCCPaymentMethods(customer) {
    const nuveiServices = require('*/cartridge/scripts/nuveiServices');

    var userUPOs = nuveiServices.getUserUPO({
        customerNo: customer.getProfile().getCustomerNo(),
    });

    var storedPaymentMethods = userUPOs.paymentMethods;
    var ccPaymentMethods = [];

    // returns empty array if no payment methods
    if (empty(storedPaymentMethods) || storedPaymentMethods.length === 0) { // eslint-disable-line no-undef
        return ccPaymentMethods;
    }

    for (var i = 0; i < storedPaymentMethods.length; i++) {
        if (storedPaymentMethods[i].paymentMethodName === 'cc_card'
            && storedPaymentMethods[i].upoStatus === 'enabled') {
            ccPaymentMethods.push(storedPaymentMethods[i]);
        }
    }

    return ccPaymentMethods;
}

/**
 *
 * @param {*} args - input parameters
 * @returns {Object} Error status
 */
function updateSavedCards(args) {
    const NuveiLogger = Logger.getLogger('Nuvei', 'nuvei');

    const nuveiHelper = require('*/cartridge/scripts/util/nuveiHelper');

    try {
        var customer = args.CurrentCustomer;

        if (!(customer && customer.getProfile() && customer.getProfile().getWallet())) {
            NuveiLogger.error('Error while updating saved cards, could not get customer data');

            return {
                error: true
            };
        }

        var creditCardPaymentMethods = getCCPaymentMethods(customer);

        var savedCreditCards = customer.getProfile().getWallet().getPaymentInstruments(PaymentInstrument.METHOD_CREDIT_CARD);
        var savedCreditCardsNuvei = customer.getProfile().getWallet().getPaymentInstruments(nuveiHelper.PAYMENT_METHOD_ID);
        Transaction.wrap(function () {
            // remove all current METHOD_CREDIT_CARD PaymentInstruments
            for (var i = 0; i < savedCreditCards.length; i++) {
                var creditCard = savedCreditCards[i];
                customer.getProfile().getWallet().removePaymentInstrument(creditCard);
            } // remove all current METHOD_ADYEN_COMPONENT PaymentInstruments


            for (var j = 0; j < savedCreditCardsNuvei.length; j++) {
                var creditCardNuvei = savedCreditCardsNuvei[j];
                customer.getProfile().getWallet().removePaymentInstrument(creditCardNuvei);
            } // Create from existing cards a paymentInstrument


            for (var index = 0; index < creditCardPaymentMethods.length; index++) {
                var payment = creditCardPaymentMethods[index];

                var expiryMonth = payment.upoData.ccExpMonth ? payment.upoData.ccExpMonth : '';
                var expiryYear = payment.upoData.ccExpYear ? '20' + payment.upoData.ccExpYear : ''; // nuvei is storing years in short presentation, ex. 21 => 2021
                var holderName = payment.upoData.ccNameOnCard ? payment.upoData.ccNameOnCard : '';
                var number = payment.upoData.ccCardNumber ? payment.upoData.ccCardNumber : '';
                var token = payment.userPaymentOptionId;
                var cardType = payment.upoData.brand ? nuveiHelper.getSFCCCardType(payment.upoData.brand) : ''; // if we have everything we need, create a new payment instrument

                if (expiryMonth && expiryYear && number && token && cardType) {
                    var newCreditCard = customer.getProfile().getWallet().createPaymentInstrument(nuveiHelper.PAYMENT_METHOD_ID);
                    newCreditCard.setCreditCardExpirationMonth(Number(expiryMonth));
                    newCreditCard.setCreditCardExpirationYear(Number(expiryYear));
                    newCreditCard.setCreditCardType(cardType);
                    newCreditCard.setCreditCardHolder(holderName);
                    newCreditCard.setCreditCardNumber(number);
                    newCreditCard.setCreditCardToken(token);
                }
            }
        });

        return {
            error: false
        };
    } catch (ex) {
        NuveiLogger
            .error(''.concat(ex.toString(), ' in ').concat(ex.fileName, ':').concat(ex.lineNumber));

        return {
            error: true
        };
    }
}

module.exports = {
    updateSavedCards: updateSavedCards
};
