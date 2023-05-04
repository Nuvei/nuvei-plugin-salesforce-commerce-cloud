'use strict';

const Calendar = require('dw/util/Calendar');
const LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
const StringUtils = require('dw/util/StringUtils');
const Logger = require('dw/system/Logger');
const URLUtils = require('dw/web/URLUtils');

const nuveiPrefs = require('*/cartridge/scripts/nuveiPreferences');
const nuveiHelper = require('*/cartridge/scripts/util/nuveiHelper');
const checksumHelper = require('*/cartridge/scripts/util/nuveiChecksumHelper');

const NuveiLogger = Logger.getLogger('Nuvei', 'nuvei');
const DMNUrl = URLUtils.https('Nuvei-DMN').toString();

const SERVICE = {
    SESSION_TOKEN: 'int.nuvei.getSessionToken',
    OPEN_ORDER: 'int.nuvei.openOrder',
    MERCHANT_PAYMENT_METHODS: 'int.nuvei.getMerchantPaymentMethods',
    GET_USER_UPO: 'int.nuvei.getUserUPO',
    DELETE_USER_UPO: 'int.nuvei.deleteUPO',
    PAYMENT_STATUS: 'int.nuvei.getPaymentStatus',
    SETTLE_TRANSACTION: 'int.nuvei.settleTransaction',
    VOID_TRANSACTION: 'int.nuvei.voidTransaction',
    REFUND_TRANSACTION: 'int.nuvei.refundTransaction',
};

const getService = function (serviceName) {
    let service = null;

    try {
        service = LocalServiceRegistry.createService(serviceName, {
            /**
             * @param {dw.svc.HTTPService} svc - HTTPService
             * @param {Object} args - Request parameters
             * @returns {Object} - Request object
             */
            createRequest: function (svc, args) {
                svc.setRequestMethod('POST');
                svc.addHeader('Content-type', 'application/json');

                if (args) {
                    return args;
                }

                return null;
            },
            parseResponse: function (svc, client) {
                return client;
            },
            getRequestLogMessage: function (msg) {
                return msg;
            },
            getResponseLogMessage: function (svc) {
                return svc.text;
            }
        });

        NuveiLogger.debug('Successfully retrive service with name {0}', serviceName);
    } catch (err) {
        NuveiLogger.error('Cannot get service instance with name {0}', serviceName);
    }

    return service;
};

const doServiceCall = function (serviceName, requestParams) {
    let responseObject = {};

    try {
        const service = getService(serviceName);

        const callResult = service.call(JSON.stringify(requestParams));

        if (!callResult.isOk()) {
            NuveiLogger.error('Call error code'
                .concat(callResult.getError().toString(), ' Error => ResponseStatus: ')
                .concat(callResult.getStatus(), ' | ResponseErrorText: ')
                .concat(callResult.getErrorMessage(), ' | ResponseText: ')
                .concat(callResult.getMsg())
            );

            responseObject.status = 'ERROR';
        } else {
            responseObject = JSON.parse(callResult.object.getText());
        }
    } catch (err) {
        NuveiLogger.error('Unexpected error: {0}', err);

        responseObject.status = 'ERROR';
    }

    return responseObject;
};

/**
 *
 * @param {Object} params - parameters
 * @param {string} type - service type
 * @returns {Object} - request parameters
 */
const buildRequestParams = function (params, type) {
    const requestParams = {
        merchantId: nuveiPrefs.getMerchantId(),
        merchantSiteId: nuveiPrefs.getMerchantSiteId(),
        timeStamp: StringUtils.formatCalendar(new Calendar(), 'YYYYMMddHHmmss'),
    };
    const userTokenId = nuveiHelper.getUserTokenId();

    if (userTokenId) {
        requestParams.userTokenId = userTokenId;
    }

    Object.keys(params).forEach(function (param) {
        requestParams[param] = params[param];
    });

    requestParams.checksum = checksumHelper.getChecksum(requestParams, type);

    return requestParams;
};

/**
 *
 * @param {Object} params - parameters
 * @param {string} params.orderNo - order number
 * @param {string} params.sessionToken - session token
 * @param {string} params.currency - currency
 * @returns {Object} - response orbject
*/
const getMerchantPaymentMethods = function (params) {
    const requestParams = buildRequestParams({
        sessionToken: params.sessionToken,
        clientRequestId: params.orderNo,
        currencyCode: params.currency,
        countryCode: 'GB',
        // 'type':'DEPOSIT', optional, Possible values: DEPOSIT, WITHDRAWAL. If no value sent, then default value is DEPOSIT
        languageCode: 'eng'
    }, checksumHelper.MERCHANT_PAYMENT_METHODS);

    return doServiceCall(SERVICE.MERCHANT_PAYMENT_METHODS, requestParams);
};

/**
 * @returns {Object} - response orbject
 */
const getSessionToken = function () {
    const requestParams = buildRequestParams({}, checksumHelper.SESSION_TOKEN);

    const response = doServiceCall(SERVICE.SESSION_TOKEN, requestParams);

    if (response.status === 'SUCCESS') {
        return response.sessionToken;
    }

    return null;
};

/**
 *
 * @param {Object} params - parameters
 * @param {number} params.amount - amout
 * @param {string} params.currency - currency
 * @returns {Object} - response orbject
 */
const openOrder = function (params) {
    const orderNo = nuveiHelper.getOrderNo();

    const requestParams = buildRequestParams({
        clientRequestId: orderNo,
        clientUniqueId: orderNo,
        currency: params.currency,
        amount: params.amount,
        transactionType: nuveiPrefs.getTransactionType(),
        deviceDetails: {
            ipAddress: request.getHttpRemoteAddress() // eslint-disable-line
        }
    }, checksumHelper.OPEN_ORDER);

    return doServiceCall(SERVICE.OPEN_ORDER, requestParams);
};

/**
 *
 * @param {Object} params - paramters
 * @param {string} params.sessionToken - session token
 * @returns {Object} - response orbject
 */
const getPaymentInformation = function (params) {
    const requestParams = {
        sessionToken: params.sessionToken
    };

    return doServiceCall(SERVICE.PAYMENT_STATUS, requestParams);
};

/**
 *
 * @param {Object} params - parameters
 * @param {string} params.orderNo - order number
 * @param {number} params.amount - amount
 * @param {string} params.currency - currency
 * @param {string} params.relatedTransactionId - TransactionId
 * @param {string} params.authCode - authCode for Transaction
 * @returns {Object} - response orbject
 */
const settleTransaction = function (params) {
    const requesetParams = buildRequestParams({
        clientUniqueId: params.orderNo,
        currency: params.currency,
        amount: params.amount,
        clientRequestId: params.orderNo,
        relatedTransactionId: params.relatedTransactionId || nuveiHelper.getTransactionId(params.orderNo, nuveiHelper.TRANSACTION_TYPES.AUTH),
        authCode: params.authCode || nuveiHelper.getAuthCode(params.orderNo, nuveiHelper.TRANSACTION_TYPES.AUTH),
        descriptorMerchantName: nuveiPrefs.getMerchantName(),
        descriptorMerchantPhone: nuveiPrefs.getMerchantPhone(),
        comment: 'Settle Transaction',
        urlDetails: {
            notificationUrl: DMNUrl
        }
    }, checksumHelper.SETTLE_TRANSACTION);

    return doServiceCall(SERVICE.SETTLE_TRANSACTION, requesetParams);
};

/**
 *
 * @param {Object} params - parameters
 * @param {string} params.orderNo - order number
 * @param {number} params.amount - amount
 * @param {string} params.currency currency
 * @param {string} params.relatedTransactionId - TransactionId
 * @param {string} params.authCode - authCode for Transaction
 * @returns {Object} - response orbject
 */
const voidTransaction = function (params) {
    const requestParams = buildRequestParams({
        clientUniqueId: params.orderNo,
        amount: params.amount,
        currency: params.currency,
        relatedTransactionId: params.relatedTransactionId || nuveiHelper.getTransactionId(params.orderNo, nuveiHelper.TRANSACTION_TYPES.AUTH),
        authCode: params.authCode || nuveiHelper.getAuthCode(params.orderNo, nuveiHelper.TRANSACTION_TYPES.AUTH),
        comment: 'Void Transaction',
        urlDetails: {
            notificationUrl: DMNUrl
        }
    }, checksumHelper.VOID_TRANSACTION);

    return doServiceCall(SERVICE.VOID_TRANSACTION, requestParams);
};

/**
 *
 * @param {Object} params - parameters
 * @param {string} params.orderNo - order rnumber
 * @param {number} params.amount - amount
 * @param {string} params.currency - currency
 * @param {string} params.relatedTransactionId - TransactionId
 * @param {string} params.authCode - authCode for Transaction
 * @returns {Object} - response orbject
 */
const refundTransaction = function (params) {
    const requestParams = buildRequestParams({
        clientUniqueId: params.orderNo,
        amount: params.amount,
        currency: params.currency,
        relatedTransactionId: params.relatedTransactionId || nuveiHelper.getTransactionId(params.orderNo, nuveiHelper.TRANSACTION_TYPES.SETTLE),
        authCode: params.authCode || nuveiHelper.getAuthCode(params.orderNo, nuveiHelper.TRANSACTION_TYPES.SETTLE),
        comment: 'Refund Transaction',
        urlDetails: {
            notificationUrl: DMNUrl
        }
    }, checksumHelper.REFUND_TRANSACTION);

    return doServiceCall(SERVICE.REFUND_TRANSACTION, requestParams);
};

/**
 * Gets Customer's stored payment methods
 *
 * @param {Object} params - parameters
 * @param {string} params.customerNo - Customer No
 * @returns {Object} - response orbject
*/
const getUserUPO = function (params) {
    const requestParams = buildRequestParams({
        userTokenId: params.customerNo,
        clientRequestId: require('dw/util/UUIDUtils').createUUID().substr(0, 20)
    }, checksumHelper.USER_UPO);

    return doServiceCall(SERVICE.GET_USER_UPO, requestParams);
};

/**
 * Deletes Customer's stored payment method
 *
 * @param {Object} params - parameters
 * @param {string} params.customerNo - Customer No
 * @param {string} params.creditCardToken - CC Token
 * @returns {Object} - response orbject
 */
const deleteUserUPO = function (params) {
    const requestParams = buildRequestParams({
        userTokenId: params.customerNo,
        userPaymentOptionId: params.creditCardToken,
        clientRequestId: require('dw/util/UUIDUtils').createUUID().substr(0, 20)
    }, checksumHelper.DELETE_UPO);

    return doServiceCall(SERVICE.DELETE_USER_UPO, requestParams);
};

module.exports = {
    getMerchantPaymentMethods: getMerchantPaymentMethods,
    openOrder: openOrder,
    getPaymentInformation: getPaymentInformation,
    settleTransaction: settleTransaction,
    voidTransaction: voidTransaction,
    refundTransaction: refundTransaction,
    getUserUPO: getUserUPO,
    deleteUserUPO: deleteUserUPO,
    getSessionToken: getSessionToken
};
