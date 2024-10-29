'use strict';

const Site = require('dw/system/Site').getCurrent();
const sitePrefs = Site.getPreferences();
const customSitePrefs = sitePrefs.getCustom();

const prefKeys = {
    enabled: 'nuveiEnabled',
    environment: 'nuveiEnvironment',
    merchantName: 'nuveiMerchantName',
    merchantPhone: 'nuveiMerchantPhone',
    merchantID: 'nuveiMerchantID',
    merchantSiteID: 'nuveiMerchantSiteID',
    merchantSecretKey: 'nuveiMerchantSecretKey',
    transactionType: 'nuveiTransactionType',
    redirectMode: 'nuveiRedirectMode',
    redirectType: 'nuveiRedirectType',
    isNative: 'nuveiIsNative',
    pluginVersion: 'nuveiVersion',
};

module.exports = {
    isEnabled: function () {
        return customSitePrefs[prefKeys.enabled];
    },
    getEnvironment: function () {   // 'test' || 'prod'
        return customSitePrefs[prefKeys.environment].value;
    },
    getMerchantName: function () {
        return customSitePrefs[prefKeys.merchantName];
    },
    getMerchantPhone: function () {
        return customSitePrefs[prefKeys.merchantPhone];
    },
    getMerchantId: function () {
        return customSitePrefs[prefKeys.merchantID];
    },
    getMerchantSiteId: function () {
        return customSitePrefs[prefKeys.merchantSiteID];
    },
    getMerchantSecretKey: function () {
        return customSitePrefs[prefKeys.merchantSecretKey];
    },
    getTransactionType: function () {
        return customSitePrefs[prefKeys.transactionType].value;
    },
    getRedirectMode: function () {
        return customSitePrefs[prefKeys.redirectMode].value;
    },
    getRedirectType: function () {
        return customSitePrefs[prefKeys.redirectType].value;
    },
    getIsNative: function () {
        return customSitePrefs[prefKeys.isNative];
    },
    getPluginVersion: function () {
        return customSitePrefs[prefKeys.pluginVersion].value;
    },
};
