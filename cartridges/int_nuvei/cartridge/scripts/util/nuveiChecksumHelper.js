'use strict';

const MessageDigest = require('dw/crypto/MessageDigest');
const Encoding = require('dw/crypto/Encoding');
const Bytes = require('dw/util/Bytes');

const parametersMap = {
    sessionToken: [
        'merchantId', 'merchantSiteId', 'clientRequestId', 'timeStamp', 'merchantSecretKey'
    ],
    openOrder: [
        'merchantId', 'merchantSiteId', 'clientRequestId', 'amount', 'currency', 'timeStamp', 'merchantSecretKey'
    ],
    merchantPaymentMethods: [
        'merchantId', 'merchantSiteId', 'clientRequestId', 'timeStamp', 'merchantSecretKey'
    ],
    settleTransaction: [
        'merchantId', 'merchantSiteId', 'clientRequestId', 'clientUniqueId', 'amount', 'currency', 'relatedTransactionId', 'authCode', 'descriptorMerchantName', 'descriptorMerchantPhone', 'comment', 'urlDetails', 'timeStamp', 'merchantSecretKey'
    ],
    voidTransaction: [
        'merchantId', 'merchantSiteId', 'clientRequestId', 'clientUniqueId', 'amount', 'currency', 'relatedTransactionId', 'authCode', 'comment', 'urlDetails', 'timeStamp', 'merchantSecretKey'
    ],
    refundTransaction: [
        'merchantId', 'merchantSiteId', 'clientRequestId', 'clientUniqueId', 'amount', 'currency', 'relatedTransactionId', 'authCode', 'comment', 'urlDetails', 'timeStamp', 'merchantSecretKey'
    ],
    DMN: [
        'merchantSecretKey', 'totalAmount', 'currency', 'responseTimeStamp', 'PPP_TransactionID', 'Status', 'productId'
    ],
    userUPO: [
        'merchantId', 'merchantSiteId', 'userTokenId', 'clientRequestId', 'timeStamp', 'merchantSecretKey'
    ],
    deleteUPO: [
        'merchantId', 'merchantSiteId', 'userTokenId', 'clientRequestId', 'userPaymentOptionId', 'timeStamp', 'merchantSecretKey'
    ],
};

const buildBytes = function (params, fields) {
    const preferences = require('*/cartridge/scripts/nuveiPreferences');
    const string = fields.map(function (key) {
        if (params[key] !== undefined && typeof params[key] !== 'object') {
            return params[key];
        }

        switch (key) {
            case 'merchantSecretKey':
                return preferences.getMerchantSecretKey();
            case 'urlDetails':
                return Object.keys(params[key]).map(function (urlKey) { return params[key][urlKey]; }).join('');
            default:
                return '';
        }
    }).join('');

    return new Bytes(string, 'utf-8');
};

module.exports = {
    SESSION_TOKEN: 'sessionToken',
    OPEN_ORDER: 'openOrder',
    MERCHANT_PAYMENT_METHODS: 'merchantPaymentMethods',
    SETTLE_TRANSACTION: 'settleTransaction',
    VOID_TRANSACTION: 'voidTransaction',
    REFUND_TRANSACTION: 'refundTransaction',
    DMN: 'DMN',
    USER_UPO: 'userUPO',
    DELETE_UPO: 'deleteUPO',

    /**
     *
     * @param {Object} params - Parameters
     * @param {string} callType - Call Type
     * @return {string} - checksum
     */
    getChecksum: function (params, callType) {
        if (parametersMap[callType] === undefined) {
            return '';
        }

        const messageDigest = new MessageDigest(MessageDigest.DIGEST_SHA_256);
        const bytes = buildBytes(params, parametersMap[callType]);
        const encodedBytes = messageDigest.digestBytes(bytes);

        return Encoding.toHex(encodedBytes);
    },

    /**
     *
     * @param {string} paramValues - parameter values
     * @return {string} - checksum
     */
    getRedirectChecksum: function (paramValues) {
        const messageDigest = new MessageDigest(MessageDigest.DIGEST_SHA_256);
        const bytes = new Bytes(paramValues, 'utf-8');
        const encodedBytes = messageDigest.digestBytes(bytes);

        return Encoding.toHex(encodedBytes);
    }
};
