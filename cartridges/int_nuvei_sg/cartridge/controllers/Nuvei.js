'use strict';
/* globals request */

const BasketMgr = require('dw/order/BasketMgr');
const Transaction = require('dw/system/Transaction');
const ResponseUtil = require('*/cartridge/scripts/util/Response');
const URLUtils = require('dw/web/URLUtils');
const Resource = require('dw/web/Resource');

const nuveiHelper = require('*/cartridge/scripts/util/nuveiHelper');
const app = require('*/cartridge/scripts/app');
const guard = require('*/cartridge/scripts/guard');
const nuveiServices = require('*/cartridge/scripts/nuveiServices');

/**
 * Handles Direct Merchant Notifications from Nuvei
 */
function DMN() {
    var statusCode = 500;

    if (nuveiHelper.verifyDMN(request.httpParameterMap)) { // eslint-disable-line no-undef
        if (nuveiHelper.createNotification(request.httpParameterMap)) { // eslint-disable-line no-undef
            statusCode = 200;
        }
    }

    response.setStatus(statusCode); // eslint-disable-line no-undef
    ResponseUtil.renderJSON({});
}

/**
 * Opens order in Nuvei side and returns data for payment creation
 */
function OrderOpen() {
    const dataJson = { error: true };
    const basket = BasketMgr.getCurrentBasket();
    const totalGrossPrice = basket.getTotalGrossPrice();
    const resOrderOpen = nuveiServices.openOrder({
        currency: totalGrossPrice.getCurrencyCode(),
        amount: totalGrossPrice.getValue(),
    });

    if (resOrderOpen) {
        Transaction.wrap(function () {
            basket.custom.nuveiSessionToken = resOrderOpen.sessionToken;
        });

        dataJson.sessionToken = resOrderOpen.sessionToken;
        dataJson.clientRequestId = resOrderOpen.clientRequestId;
        dataJson.userTokenId = resOrderOpen.userTokenId;
        dataJson.error = false;
    }

    ResponseUtil.renderJSON(dataJson);
}

/**
 * Gets or creates a billing address and copies it to the billingaddress form. Also sets the customer email address
 * to the value in the billingAddress form.
 *
 * @transaction
 * @param {module:models/CartModel~CartModel} cart - A CartModel wrapping the current Basket.
 * @returns {boolean} true
 */
function handleBillingAddress(cart) {
    var billingAddress = cart.getBillingAddress();
    Transaction.wrap(function () {
        if (!billingAddress) {
            billingAddress = cart.createBillingAddress();
        }

        app.getForm('billing.billingAddress.addressFields').copyTo(billingAddress);
        app.getForm('billing.billingAddress.addressFields.states').copyTo(billingAddress);

        cart.setCustomerEmail(app.getForm('billing').object.billingAddress.email.emailAddress.value);
    });

    return true;
}

/**
 * Handles Billing Address
 */
function handleBilling() {
    var cart = app.getModel('Cart').get();
    handleBillingAddress(cart);
    ResponseUtil.renderJSON({
        error: false
    });
}

/**
 * Endpoint to Show IFrame
 */
function showiframe() {
    var redirectSettings = require('*/cartridge/scripts/util/nuveiHelperHosted').getRedirectSettings(true);
    app.getView({
        redirectSettings: redirectSettings
    }).render('checkout/billing/nuveiIframe');
}

/**
 * Endpoint to handle IFrame
 *
 * @param {Url} url - URL for iframe redirect
 */
function handleIframe(url) {
    var cart = app.getModel('Cart').get();
    app.getForm('billing').object.fulfilled.value = true;
    app.getController('COBilling').HandlePaymentSelection(cart); // eslint-disable-line new-cap
    app.getView({
        redirect: url
    }).render('checkout/billing/nuveiIframeResponse');
}

/**
 * Nuvei-SubmitPayment endpoint will submit the payment information and render the checkout
 * place order page allowing the shopper to confirm and place the order
 *
 * @returns {Object} iframe handling result or controller method execution
 */
function submitPayment() {
    const collectionsHelper = require('*/cartridge/scripts/nuvei/util/collections');
    const nuveiPrefs = require('*/cartridge/scripts/nuveiPreferences');
    const isIframe = nuveiPrefs.getRedirectType() === 'iFrame';
    const secret = nuveiPrefs.getMerchantSecretKey();
    const data = request.httpParameterMap;
    const compare = data.advanceResponseChecksum.getValue();
    const nuveiResponse = {
        step: 'submitPayment',
        data: [
            secret, data.totalAmount.getValue(), data.currency.getValue(), data.responseTimeStamp.getValue(), data.PPP_TransactionID.getValue(), data.Status.getValue(), data.productId.getValue()
        ],
        compare: compare,
        error: false
    };
    const stringToHash = nuveiResponse.data.join('');

    const hash = require('*/cartridge/scripts/util/nuveiChecksumHelper').getRedirectChecksum(stringToHash);

    if (data.Status.getValue() === 'APPROVED' && hash === compare) { // checksum from response is OK
        // save data for response in basket
        let currentBasket = BasketMgr.getCurrentBasket();

        const transactionType = nuveiPrefs.getTransactionType();
        const transactionId = [transactionType, data.TransactionID.getValue()].join(' | ');
        const authCode = [transactionType, data.AuthCode.getValue()].join(' | ');
        const merchantUniqueID = [transactionType, (data.merchant_unique_id.getValue() || data.ClientUniqueId.getValue())].join(' | ');

        Transaction.wrap(function () {
            currentBasket.custom.nuveiResponseToHash = JSON.stringify(nuveiResponse);
            currentBasket.custom.nuveiMerchantUniqueID = collectionsHelper.addToSetOfStrings(currentBasket.custom.nuveiMerchantUniqueID, merchantUniqueID);
            currentBasket.custom.nuveiTransactionID = collectionsHelper.addToSetOfStrings(currentBasket.custom.nuveiTransactionID, transactionId);
            currentBasket.custom.nuveiAuthCode = collectionsHelper.addToSetOfStrings(currentBasket.custom.nuveiAuthCode, authCode);
        });

        return isIframe ? handleIframe(URLUtils.https('COSummary-Start').toString()) : app.getController('COSummary').Start(); // eslint-disable-line new-cap
    }

    nuveiHelper.setErrorMessage(Resource.msg('error.payment.not.valid', 'checkout', null));

    return isIframe ? handleIframe(URLUtils.https('COBilling-Start').toString()) : app.getController('COBilling').Start(); // eslint-disable-line new-cap
}

/**
 * Redirects on COBilling-Start
 */
function Back() {
    app.getView({
        redirect: URLUtils.https('COBilling-Start').toString()
    }).render('checkout/billing/nuveiIframeResponse');
}

exports.DMN = guard.ensure(['https', 'post'], DMN);
exports.SubmitPayment = guard.ensure(['https', 'get'], submitPayment);
exports.OrderOpen = guard.ensure(['https', 'get'], OrderOpen);
exports.Showiframe = guard.ensure(['https', 'get'], showiframe);
exports.HandleBilling = guard.ensure(['https', 'post'], handleBilling);
exports.Back = guard.ensure(['https', 'get'], Back);
