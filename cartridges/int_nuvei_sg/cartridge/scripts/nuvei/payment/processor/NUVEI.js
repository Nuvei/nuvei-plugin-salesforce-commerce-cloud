
/* API Includes */
const OrderMgr = require('dw/order/OrderMgr');
const Resource = require('dw/web/Resource');
const PaymentMgr = require('dw/order/PaymentMgr');
const Transaction = require('dw/system/Transaction');
const NuveiLogger = require('dw/system/Logger').getLogger('Nuvei', 'nuvei');

const nuveiHelper = require('*/cartridge/scripts/util/nuveiHelper');
const nuveiServices = require('*/cartridge/scripts/nuveiServices');
const nuveiPrefs = require('*/cartridge/scripts/nuveiPreferences');
const nuveiHelperHosted = require('*/cartridge/scripts/util/nuveiHelperHosted');

/**
 * Handles a payment using  NUVEI. The payment is handled by using the NUVEI processor
 * @param {Object} args - object of arguments to work with
 * @return {Object} - error or success
 */
const Handle = function (args) {
    const serverErrors = [];
    var Cart = require('*/cartridge/scripts/models/CartModel');
    try {
        var cart = Cart.get(args.Basket);
        Transaction.wrap(function () {
            cart.removeExistingPaymentInstruments('NUVEI');
            cart.createPaymentInstrument('NUVEI', cart.getNonGiftCertificateAmount());
        });
    } catch (e) {
        serverErrors.push(
            Resource.msg('error.payment.processor.not.supported', 'checkout', null)
        );
        return {
            serverErrors: serverErrors,
            error: true
        };
    }

    return {
        error: false
    };
};

/**
 * Authorizes a payment using  BREAD. The payment is authorized by using the BREAD processor
 * @param {Object} args - object of arguments to work with
 * @return {Object} - error or authorized
 */
const Authorize = function (args) {
    const orderNo = args.OrderNo;
    const order = OrderMgr.getOrder(orderNo);
    const paymentInstrument = args.PaymentInstrument;
    const paymentProcessor = PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor();
    const forReturn = {
        authorized: true,
        error: false,
        serverErrors: [],
    };

    if (nuveiPrefs.getRedirectMode() === 'Hosted Page') {
        const paymentResult = nuveiHelperHosted.checkPayment(order);
        if (paymentResult.error) {
            forReturn.authorized = false;
            forReturn.error = true;
            NuveiLogger.debug('Payment error {0}', paymentResult.errorMessage);
        }
    } else {
        const paymentInformation = nuveiServices.getPaymentInformation({
            sessionToken: nuveiHelper.getSessionToken(order)
        });

        if (paymentInformation.status === 'SUCCESS') {
            nuveiHelper.saveTransactionInfo(order, paymentInformation);
        } else {
            forReturn.error = true;
            forReturn.authorized = false;
            forReturn.serverErrors.push(
                Resource.msg('error.technical', 'checkout', null)
            );
            NuveiLogger.debug('Payment error {0}, reason: {1}', paymentInformation.errCode, paymentInformation.reason);
        }
    }

    Transaction.wrap(function () {
        if (!forReturn.error) {
            paymentInstrument.paymentTransaction.transactionID = nuveiHelper.getTransactionId(order);
        }

        paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
    });

    return forReturn;
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

exports.Handle = Handle;
exports.Authorize = Authorize;
exports.Capture = Capture;
