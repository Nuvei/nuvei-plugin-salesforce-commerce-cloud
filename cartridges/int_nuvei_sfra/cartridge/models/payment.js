'use strict';

const parent = module.superModule;

/**
 * Extends Nuvei payment instrument with detailed data to be shown during checkout
 * @param {Array} paymentInstruments payment instruments already collected by parent model
 */
function extendNuveiInfo(paymentInstruments) {
    for (let idx = 0; idx < paymentInstruments.length; idx++) {
        let paymentInstrument = paymentInstruments[idx];

        if (paymentInstrument.paymentMethod === 'NUVEI') {
            paymentInstrument.expirationYear = '';
            paymentInstrument.type = 'Nuvei';
            paymentInstrument.maskedCreditCardNumber = '';
            paymentInstrument.expirationMonth = '';
        }
    }
}
/**
 * Payment class that represents payment information for the current basket
 * @param {dw.order.Basket} currentBasket - the target Basket object
 * @constructor
 */
function Payment(currentBasket) {
    parent.apply(this, arguments);

    if (this.selectedPaymentInstruments && this.selectedPaymentInstruments.length > 0) {
        extendNuveiInfo(this.selectedPaymentInstruments, currentBasket.paymentInstruments);
    }
}

module.exports = Payment;
