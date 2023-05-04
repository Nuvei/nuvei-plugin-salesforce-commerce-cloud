'use strict';

const OrderMgr = require('dw/order/OrderMgr');
const Resource = require('dw/web/Resource');
const Transaction = require('dw/system/Transaction');
const NuveiLogger = require('dw/system/Logger').getLogger('Nuvei', 'nuvei');

const nuveiHelper = require('*/cartridge/scripts/util/nuveiHelper');
const nuveiServices = require('*/cartridge/scripts/nuveiServices');
const nuveiPrefs = require('*/cartridge/scripts/nuveiPreferences');
const nuveiHelperHosted = require('*/cartridge/scripts/util/nuveiHelperHosted');

/**
 * Verifies that entered credit card information is a valid card. If the information is valid a
 * credit card payment instrument is created
 * @param {dw.order.Basket} basket Current users's basket
 * @param {Object} paymentInformation - the payment information
 * @param {string} paymentMethodID - paymentmethodID
 * @param {Object} req the request object
 * @return {Object} returns an error object
 */
const Handle = function (basket, paymentInformation, paymentMethodID, req) { // eslint-disable-line no-unused-vars
    const fieldErrors = [];
    const serverErrors = [];
    try {
        const currentBasket = basket;
        Transaction.wrap(function () {
            const collections = require('*/cartridge/scripts/util/collections');

            const paymentInstruments = currentBasket.getPaymentInstruments();
            collections.forEach(paymentInstruments, function (item) {
                currentBasket.removePaymentInstrument(item);
            });
            const paymentInstrument = currentBasket.createPaymentInstrument( // eslint-disable-line no-unused-vars
                'NUVEI', currentBasket.totalGrossPrice
            );
        });
    } catch (e) {
        serverErrors.push(
            Resource.msg('error.payment.processor.not.supported', 'checkout', null)
        );
        return {
            fieldErrors: fieldErrors,
            serverErrors: serverErrors,
            error: true
        };
    }
    return {
        fieldErrors: fieldErrors,
        serverErrors: serverErrors,
        error: false
    };
};

/**
 * Authorizes a payment using a credit card. Customizations may use other processors and custom
 *      logic to authorize credit card payment.
 * @param {number} orderNumber - The current order's number
 * @param {dw.order.PaymentInstrument} paymentInstrument -  The payment instrument to authorize
 * @param {dw.order.PaymentProcessor} paymentProcessor -  The payment processor of the current
 *      payment method
 * @return {Object} returns an error object
 */
const Authorize = function (orderNumber, paymentInstrument, paymentProcessor) {
    const order = OrderMgr.getOrder(orderNumber);
    const serverErrors = [];
    const fieldErrors = {};
    let error = false;

    Transaction.begin();

    try {
        paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);

        if (nuveiPrefs.getRedirectMode() === 'Hosted Page') {
            const paymentResult = nuveiHelperHosted.checkPayment(order);

            if (paymentResult.error) {
                error = true;
                serverErrors.push(Resource.msg('error.technical', 'checkout', null));
                NuveiLogger.debug('Payment error {0}', paymentResult.errorMessage);
            }
        } else {
            const paymentInformation = nuveiServices.getPaymentInformation({ sessionToken: nuveiHelper.getSessionToken(order) });

            if (paymentInformation.status === 'SUCCESS') {
                nuveiHelper.saveTransactionInfo(order, paymentInformation);
            } else {
                error = true;
                serverErrors.push(Resource.msg('error.technical', 'checkout', null));
                NuveiLogger.debug('Payment error {0}, reason: {1}', paymentInformation.errCode, paymentInformation.reason);
            }
        }

        if (!error) {
            paymentInstrument.paymentTransaction.setTransactionID(nuveiHelper.getTransactionId(order));
        }

        Transaction.commit();
    } catch (e) {
        NuveiLogger.error('Authorize failed: ' + e.message());
        error = true;
        serverErrors.push(
            Resource.msg('error.technical', 'checkout', null)
        );
        Transaction.rollback();
    }

    return {
        fieldErrors: fieldErrors,
        serverErrors: serverErrors,
        error: error
    };
};

const Capture = function (args) {
    const serverErrors = [];
    const fieldErrors = {};
    const order = OrderMgr.getOrder(args.OrderNo);
    const totalGrossPrice = order.getTotalGrossPrice();

    let error = false;

    const settleResult = nuveiServices.settleTransaction({
        orderNo: order.getOrderNo(),
        currency: totalGrossPrice.getCurrencyCode(),
        amount: totalGrossPrice.getValue(),
    });

    try {
        Transaction.begin();

        if (settleResult && settleResult.status === 'SUCCESS') {
            nuveiHelper.saveTransactionInfo(order, settleResult);
        }

        Transaction.commit();
    } catch (e) {
        error = true;
        serverErrors.push(
            Resource.msg('error.technical', 'checkout', null)
        );
        Transaction.rollback();
    }

    return {
        fieldErrors: fieldErrors,
        serverErrors: serverErrors,
        error: error
    };
};

module.exports = {
    Handle: Handle,
    Authorize: Authorize,
    Capture: Capture,
};
