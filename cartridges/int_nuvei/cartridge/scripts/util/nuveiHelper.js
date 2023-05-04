'use strict';
/* globals session */

const OrderMgr = require('dw/order/OrderMgr');
const Logger = require('dw/system/Logger');
const Transaction = require('dw/system/Transaction');
const Resource = require('dw/web/Resource');

const NuveiLogger = Logger.getLogger('Nuvei', 'nuvei');

const TRANSACTION_TYPES = {
    AUTH: 'Auth',
    SETTLE: 'Settle',
};

const NUVEI_PAYMENT_METHOD_ID = 'NUVEI';

const getOrder = function (order) {
    return typeof order === 'object' ? order : OrderMgr.getOrder(order);
};

/**
 * Returns number for new order from session. Creates new number when it doesn't exist.
 * @returns {string} - order number
 */
const getOrderNo = function () {
    if (empty(session.privacy.orderNo)) { // eslint-disable-line
        session.privacy.orderNo = OrderMgr.createOrderNo(); // eslint-disable-line
    }

    return session.privacy.orderNo; // eslint-disable-line
};

/**
 * Removes orderNo from session.
 */
const resetOrderNo = function () {
    delete session.privacy.orderNo; // eslint-disable-line
};

const getUserTokenId = function () {
    return customer.isAuthenticated() // eslint-disable-line
    ? customer.getProfile().getCustomerNo() // eslint-disable-line
    : (Math.random() * Math.pow(10, 10)).toFixed();
};

/**
 * Returns Auth Transaction ID from order
 * @param {dw.order.Order|string} orderNo - Order or order number
 * @param {string} transactionType - transaction type
 * @returns {string} - Auth Code
 */
const getTransactionId = function (orderNo, transactionType) {
    const order = getOrder(orderNo);
    const type = transactionType || '.+';

    if (!order) {
        return '';
    }

    const transactionID = order.getCustom().nuveiTransactionID;
    const regexp = new RegExp('^' + type + ' \\| (\\d{19})$');
    let regExpResult;

    for (let idx = 0; idx < transactionID.length; idx++) {
        regExpResult = regexp.exec(transactionID[idx]);
        if (regExpResult) {
            return regExpResult[1];
        }
    }

    return '';
};

/**
 * Returns Auth Code from order
 * @param {dw.order.Order|string} orderNo - Order or order number
 * @param {string} transactionType - transaction type
 * @returns {string} - Auth Code
 */
const getAuthCode = function (orderNo, transactionType) {
    const order = getOrder(orderNo);

    if (!order) {
        return '';
    }

    const transactionID = order.getCustom().nuveiAuthCode;
    const regexp = new RegExp('^' + transactionType + ' \\| (\\d{6})$');
    let regExpResult;

    for (let idx = 0; idx < transactionID.length; idx++) {
        regExpResult = regexp.exec(transactionID[idx]);
        if (regExpResult) {
            return regExpResult[1];
        }
    }

    return '';
};

/**
 * Returns Nuvei Session Token from order
 * @param {dw.order.Order|string} orderNo - Order or order number
 * @returns {string} - Session Token
 */
const getSessionToken = function (orderNo) {
    const order = getOrder(orderNo);

    if (!order) {
        return '';
    }

    return order.getCustom().nuveiSessionToken;
};

/**
 * Checks is Order placed using Nuvei
 * @param {dw.order.Order|string} orderNo - Order or order number
 * @returns {boolean} - order has nuvei payment method
 */
const isNuvei = function (orderNo) {
    const order = getOrder(orderNo);

    if (!order) {
        return false;
    }

    return order.getPaymentInstrument().getPaymentMethod() === NUVEI_PAYMENT_METHOD_ID;
};

const isDirectMode = function () {
    return require('*/cartridge/scripts/nuveiPreferences').getRedirectMode() === 'Direct';
};

/**
 * Returns nuvei payment instrument from order
 * @param {dw.order.Order} order - order
 * @returns {dw.order.PaymentInstrument|null} - nuvei payment instrument
 */
const getPaymentInstrument = function (order) {
    const paymentInstruments = order.getPaymentInstruments();
    const iterator = paymentInstruments.iterator();
    let paymentInstrument;

    while (iterator.hasNext()) {
        paymentInstrument = iterator.next();
        if (paymentInstrument.getPaymentMethod() === NUVEI_PAYMENT_METHOD_ID) {
            return paymentInstrument;
        }
    }

    return null;
};

/**
 * Verifies direct merchant notificatrion
 * @param {dw.web.HttpParameterMap} parameterMap - request parameter map
 * @returns {boolean} - indicates validity of request
 */
const verifyDMN = function (parameterMap) {
    const nuveiChecksumHelper = require('*/cartridge/scripts/util/nuveiChecksumHelper');
    const checksum = parameterMap.advanceResponseChecksum.value;
    const amount = parameterMap.totalAmount.value;
    const currency = parameterMap.currency.value;
    const params = {
        totalAmount: amount,
        currency: currency,
        responseTimeStamp: parameterMap.responseTimeStamp.value,
        PPP_TransactionID: parameterMap.PPP_TransactionID.value,
        Status: parameterMap.Status.value,
        productId: parameterMap.productId.value,
    };

    if (nuveiChecksumHelper.getChecksum(params, nuveiChecksumHelper.DMN) !== checksum) {
        return false;
    }

    return true;
};

/**
 * Creates custom object from direct merchant notification
 * @param {dw.web.HttpParameterMap} paymentData - request parameter map
 * @returns {boolean} - result of creation
 */
const createNotification = function (paymentData) {
    const nuveiCustomObjectsHelper = require('*/cartridge/scripts/util/nuveiCustomObjectsHelper');
    try {
        nuveiCustomObjectsHelper.create(paymentData);
    } catch (e) {
        NuveiLogger.error('Direct Merchant Notification failed. Error: ' + e.toString());
        return false;
    }

    return true;
};

const getSFCCCardType = function (cardTypeInput) {
    let cardType = '';

    if (!empty(cardTypeInput)) { // eslint-disable-line no-undef
        switch (cardTypeInput) {
            case 'visa':
                cardType = 'Visa';
                break;

            case 'amex':
                cardType = 'Amex';
                break;

            case 'master_card':
                cardType = 'Master Card';
                break;

            case 'discover':
                cardType = 'Discover';
                break;

            case 'diners':
                cardType = 'DinersClub';
                break;

            default:
                cardType = '';
                break;
        }
    }
    return cardType;
};

/**
 * Adds transaction in
 * @param {dw.order.Order} order - target order
 * @param {Object} paymentInformation - response from Nuvei
 * @returns {Object} - result info
 */
const saveTransactionInfo = function (order, paymentInformation) {
    const result = {
        error: true,
        message: Resource.msg('msg.order.information.notupdated', 'nuvei', '')
    };

    if (!order) {
        result.message = Resource.msgf('msg.order.doesntexist', 'nuvei', '');

        return result;
    }

    const collectionsHelper = require('*/cartridge/scripts/nuvei/util/collections');

    Transaction.wrap(function () {
        const merchantUniqueId = [paymentInformation.transactionType, paymentInformation.clientUniqueId].join(' | ');
        const transactionId = [paymentInformation.transactionType, paymentInformation.transactionId].join(' | ');
        const authCode = [paymentInformation.transactionType, paymentInformation.authCode].join(' | ');
        const custom = order.getCustom();

        custom.nuveiMerchantUniqueID = collectionsHelper.addToSetOfStrings(order.custom.nuveiMerchantUniqueID, merchantUniqueId);
        custom.nuveiTransactionID = collectionsHelper.addToSetOfStrings(order.custom.nuveiTransactionID, transactionId);
        custom.nuveiAuthCode = collectionsHelper.addToSetOfStrings(order.custom.nuveiAuthCode, authCode);

        result.error = false;
        result.message = Resource.msg('msg.order.information.updated', 'nuvei', '');
    });

    return result;
};

/**
 * Stores error message to session
 * @param {string} message - message text
 */
const setErrorMessage = function (message) {
    session.privacy.nuveiErrorMessage = message;
};

/**
 * Returns error message from session
 * @return {string} - message text
 */
const getErrorMessage = function () {
    return session.privacy.nuveiErrorMessage;
};

/**
 * Clears error message
 */
const clearErrorMessage = function () {
    delete session.privacy.nuveiErrorMessage;
};

module.exports = {
    TRANSACTION_TYPES: TRANSACTION_TYPES,
    PAYMENT_METHOD_ID: NUVEI_PAYMENT_METHOD_ID,
    getOrderNo: getOrderNo,
    resetOrderNo: resetOrderNo,
    getSessionToken: getSessionToken,
    getTransactionId: getTransactionId,
    getAuthCode: getAuthCode,
    isNuvei: isNuvei,
    isDirectMode: isDirectMode,
    getUserTokenId: getUserTokenId,
    createNotification: createNotification,
    getPaymentInstrument: getPaymentInstrument,
    getSFCCCardType: getSFCCCardType,
    verifyDMN: verifyDMN,
    saveTransactionInfo: saveTransactionInfo,
    logger: NuveiLogger,
    getErrorMessage: getErrorMessage,
    setErrorMessage: setErrorMessage,
    clearErrorMessage: clearErrorMessage,
};
