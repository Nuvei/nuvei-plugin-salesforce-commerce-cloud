'use strict';

const Calendar = require('dw/util/Calendar');
const StringUtils = require('dw/util/StringUtils');
const URLUtils = require('dw/web/URLUtils');
var OrderMgr = require('dw/order/OrderMgr');

const nuveiPrefs = require('*/cartridge/scripts/nuveiPreferences');
const checksumHelper = require('*/cartridge/scripts/util/nuveiChecksumHelper');
const nuveiHelper = require('*/cartridge/scripts/util/nuveiHelper');

const TIMESTAMP_FORMAT = 'YYYY-MM-dd-HH:mm:ss';
const ENCODING_UTF8 = 'utf-8';
const NUVEI_VERSION = '4.0.0';
const URLS = {
    NOTIFY: URLUtils.https('Nuvei-DMN').toString(),
    SUCCESS: URLUtils.https('Nuvei-SubmitPayment').toString(),
    ERROR: URLUtils.https('Nuvei-SubmitPayment').toString(),
    PENDING: URLUtils.https('Nuvei-SubmitPayment').toString(),
    BACK: URLUtils.https('Nuvei-Back').toString()
};
const REDIRECT_ENDPOINT = nuveiPrefs.getEnvironment() === 'test' ?
    'https://ppp-test.safecharge.com/ppp/purchase.do' : 'https://secure.safecharge.com/ppp/purchase.do';

/**
 * Gets the device type of the current user.
 * @returns {string} the device type (desktop, mobile or tablet)
 */
function getDeviceType() {
    const httpUserAgent = request.httpUserAgent;     // eslint-disable-line no-undef
    const iPhoneDevice = 'iPhone';
    const iPadDevice = 'iPad';
    const androidDevice = 'Android'; // Mozilla/5.0 (Linux; U; Android 2.3.4; en-us; ADR6300 Build/GRJ22) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1
    let deviceType = 'desktop';


    if (!httpUserAgent) {
        return null;
    }

    if (httpUserAgent.indexOf(iPhoneDevice) > -1) {
        deviceType = 'mobile';
    } else if (httpUserAgent.indexOf(androidDevice) > -1) {
        if (httpUserAgent.toLowerCase().indexOf('mobile') > -1) {
            deviceType = 'mobile';
        }
    } else if (httpUserAgent.indexOf(iPadDevice) > -1) {
        deviceType = 'mobile';  // tablet
    }

    return deviceType;
}

const setMainAttributes = function (params) {
    const lineItemCtnr = params.lineItemCtnr ;
    let paramsInObject = params.addTo;
    // credentials
    paramsInObject.merchant_id = nuveiPrefs.getMerchantId();
    paramsInObject.merchant_site_id = nuveiPrefs.getMerchantSiteId();
    // common attributes
    paramsInObject.time_stamp = StringUtils.formatCalendar(new Calendar(), TIMESTAMP_FORMAT);
    paramsInObject.currency = lineItemCtnr.getCurrencyCode();
    paramsInObject.encoding = ENCODING_UTF8;
    paramsInObject.version = NUVEI_VERSION;

    // urls
    paramsInObject.notify_url = URLS.NOTIFY;
    paramsInObject.success_url = URLS.SUCCESS;
    paramsInObject.error_url = URLS.ERROR;
    paramsInObject.pending_url = URLS.PENDING;
    paramsInObject.back_url = URLS.BACK;
	paramsInObject.isNative = nuveiPrefs.getIsNative() ? 1 : 0;

    return paramsInObject;
};

const roundNumber = function (numb) {
    return +(Math.round(numb + 'e+2') + 'e-2');
};

const setBasketValues = function (params) {
    const TaxMgr = require('dw/order/TaxMgr');
    const lineItemCtnr = params.lineItemCtnr;
    const productLineItems = lineItemCtnr.getProductLineItems();
    const productLineItemsIterator = productLineItems.iterator();
    let paramsInObject = params.addTo;
    let productIdentifierNumber = 1;
    let calculatedAmount = 0; // for fixing rounding issue

    while (productLineItemsIterator.hasNext()) {
        let productLineItem = productLineItemsIterator.next();

        paramsInObject['item_name_' + productIdentifierNumber] = productLineItem.getProductName();
        paramsInObject['item_number_' + productIdentifierNumber] = productLineItem.getProductID();
        paramsInObject['item_quantity_' + productIdentifierNumber] = productLineItem.getQuantity().getValue();
        paramsInObject['item_amount_' + productIdentifierNumber] = roundNumber(productLineItem.getProratedPrice().getValue() / productLineItem.getQuantity().getValue());
        calculatedAmount += paramsInObject['item_amount_' + productIdentifierNumber] * paramsInObject['item_quantity_' + productIdentifierNumber];

        productIdentifierNumber++;
    }

    paramsInObject.numberofitems = productLineItems.getLength();
    paramsInObject.shipping = lineItemCtnr.getAdjustedShippingTotalPrice().getValue();
    const totalGrossPriceMoney = lineItemCtnr.getTotalGrossPrice();
    const totalTaxMoney = lineItemCtnr.getTotalTax();
    const subtotalMoney = totalGrossPriceMoney.subtract(totalTaxMoney);

    // calculate taxation
    if (TaxMgr.getTaxationPolicy() === TaxMgr.TAX_POLICY_NET) {   // if taxation policy is net
        paramsInObject.total_tax = roundNumber((totalTaxMoney.getValue() / subtotalMoney.getValue()) * 100);
        calculatedAmount += totalTaxMoney.getValue();
    }

    paramsInObject.total_amount = lineItemCtnr.getTotalGrossPrice().getValue();
    paramsInObject.merchant_unique_id = nuveiHelper.getOrderNo();

    calculatedAmount += paramsInObject.shipping;

    // fixing rounding issue
    const totalAmountDifference = +(((calculatedAmount + 'e2') - (paramsInObject.total_amount + 'e2')) + 'e-2'); // fix for floating point issue

    if (totalAmountDifference < 0) {
        paramsInObject.handling = Math.abs(totalAmountDifference);
    } else if (totalAmountDifference > 0) {
        paramsInObject.discount = totalAmountDifference;
    }

    return paramsInObject;
};

const saveBillingInBasket = function (params) {
    // save billing info into the basket
    const Transaction = require('dw/system/Transaction');
    const lineItemCtnr = params.lineItemCtnr;
    const billingInfo = params.billingInfo;
    const billingAddress = lineItemCtnr.billingAddress;
    Transaction.wrap(function () {
        if (!billingAddress) {
            billingAddress = lineItemCtnr.createBillingAddress();
        }

        billingAddress.setFirstName(billingInfo.address.firstName);
        billingAddress.setLastName(billingInfo.address.lastName);
        billingAddress.setAddress1(billingInfo.address.address1);
        billingAddress.setAddress2(billingInfo.address.address2);
        billingAddress.setCity(billingInfo.address.city);
        billingAddress.setPostalCode(billingInfo.address.postalCode);
        if (Object.prototype.hasOwnProperty.call(billingInfo.address, 'stateCode')) {
            billingAddress.setStateCode(billingInfo.address.stateCode);
        }
        billingAddress.setCountryCode(billingInfo.address.countryCode);

        billingAddress.setPhone(billingInfo.contact.phone);
        lineItemCtnr.setCustomerEmail(billingInfo.contact.email);
    });
};

const setCustomerValues = function (params) {
    const lineItemCtnr = params.lineItemCtnr;
    const basketCustomer = lineItemCtnr.getCustomer();
    const countriesWithStates = ['US', 'CA', 'IN'];
    let paramsInObject = params.addTo;
    let billingAddress = lineItemCtnr.getBillingAddress();
    let userTokenId = '';

    if (basketCustomer.isAuthenticated()) {
        userTokenId = basketCustomer.getProfile().getCustomerNo();
    } else {
        userTokenId = (Math.random() * Math.pow(10, 10)).toFixed();
    }

    paramsInObject.user_token_id = userTokenId;

    if (params.billingInfo) {   // use params from FE form
        const contactInfo = params.billingInfo.contact;
        billingAddress = params.billingInfo.address;
        paramsInObject.first_name = billingAddress.firstName;
        paramsInObject.last_name = billingAddress.lastName;
        paramsInObject.email = contactInfo.email;
        paramsInObject.address1 = billingAddress.address1;
        paramsInObject.city = billingAddress.city;
        paramsInObject.country = billingAddress.countryCode;

        if (countriesWithStates.indexOf(paramsInObject.country) > -1) {
            paramsInObject.state = billingAddress.stateCode;  // for customers based in the US, Canada and India only
        }

        paramsInObject.zip = billingAddress.postalCode;
        paramsInObject.phone1 = contactInfo.phone;
        // save billing info into the basket
        saveBillingInBasket(params);
    } else {    // use basket saved values
        paramsInObject.first_name = billingAddress.getFirstName();
        paramsInObject.last_name = billingAddress.getLastName();
        paramsInObject.email = lineItemCtnr.getCustomerEmail();
        paramsInObject.address1 = billingAddress.getAddress1();
        paramsInObject.city = billingAddress.getCity();
        paramsInObject.country = billingAddress.getCountryCode().getValue().toString();

        if (countriesWithStates.indexOf(paramsInObject.country) > -1) {
            paramsInObject.state = billingAddress.getStateCode();  // for customers based in the US, Canada and India only
        }

        paramsInObject.zip = billingAddress.getPostalCode();
        paramsInObject.phone1 = billingAddress.getPhone();
    }

    return paramsInObject;
};

const getRequestParamsInObject = function (params) {
    const BasketMgr = require('dw/order/BasketMgr');
    var lineItemCtnr = BasketMgr.getCurrentBasket();

    if (!lineItemCtnr) {
        // If this function is called from Nuvei-Redirect a new
        // order has already been created to reserve inventory and the
        // basket has been deleted accordingly. The newly-created
        // order is used as a line item container
        lineItemCtnr = OrderMgr.getOrder(params.orderNo);
    }

    let paramsInObject = {};
    // main attributes
    paramsInObject = setMainAttributes({
        lineItemCtnr: lineItemCtnr,
        addTo: paramsInObject
    });
    // basket
    paramsInObject = setBasketValues({
        lineItemCtnr: lineItemCtnr,
        addTo: paramsInObject
    });
    // customer
    paramsInObject = setCustomerValues({
        billingInfo: params.billingInfo,
        lineItemCtnr: lineItemCtnr,
        addTo: paramsInObject
    });

    return paramsInObject;
};

const getRequestURLParams = function (paramsInObject) {
    const Encoding = require('dw/crypto/Encoding');
    let checkSumValues = nuveiPrefs.getMerchantSecretKey(); // initial value with SecretKey, will be concatenated with other params
    let urlParamsAsList = [];
    let listOfAttributes = [];

    Object.keys(paramsInObject).forEach(function (item) {
        listOfAttributes.push(item);
    });
    listOfAttributes.sort();

    for (let i = 0; i < listOfAttributes.length; i++) {
        let paramValue = paramsInObject[listOfAttributes[i]];
        if (paramValue !== null) {
            checkSumValues += paramValue;
            let urlParamAsString = listOfAttributes[i] + '=' + Encoding.toURI(paramValue);
            urlParamsAsList.push(urlParamAsString);
        }
    }

    const checkSum = checksumHelper.getRedirectChecksum(checkSumValues);
    urlParamsAsList.push('checksum=' + checkSum);
    const urlParamsAsString = urlParamsAsList.join('&');
    return urlParamsAsString;
};

/**
 * function to get recirect settings based on specification
 * For cell phone it will be always new page.
 *
 * @param {boolean} getData - flag to set URL in redirectSettings
 * @param {Object} billingInfo - billing data from storefront
 * @param {string|null} orderNo - current order number,
 * @return {Object} - redirect settings
*/
const getRedirectSettings = function (getData, billingInfo, orderNo) {
    let redirectSettings = {
        enabled: false
    };

    if (nuveiPrefs.isEnabled()) {
        redirectSettings = {
            enabled: true,
            mode: nuveiPrefs.getRedirectMode(), // 'Hosted Page' | 'Direct'
            type: nuveiPrefs.getRedirectType(), // 'iFrame' | 'redirect'
            redirect: false,
            url: '',
            error: {
                isError: false,
                message: ''
            },
            getDataUrl: URLUtils.url('Nuvei-HostedPaymentFormData').toString()
        };

        if (redirectSettings.mode === 'Hosted Page') {  // otherwise we don't need to get all values
            const deviceType = getDeviceType();

            if (deviceType === 'mobile') {  // For cell phone it will be always new page.
                redirectSettings.type = 'redirect';
            }

            if (redirectSettings.type === 'redirect') {
                redirectSettings.redirect = true;   // value for submit payment button
            }

            // get data
            if (getData) {
                const paramsInObject = getRequestParamsInObject({
                    billingInfo: billingInfo, // from FE-AJAX, after billing address submit
                    orderNo: orderNo
                });
                const urlParams = getRequestURLParams(paramsInObject);
                redirectSettings.url = REDIRECT_ENDPOINT + '?' + urlParams;
            }
        }
    }
    return redirectSettings;
};

const getResponseForFE = function () {
    const BasketMgr = require('dw/order/BasketMgr');
    const Resource = require('dw/web/Resource');
    const Transaction = require('dw/system/Transaction');
    const currentBasket = BasketMgr.getCurrentBasket();
    const nuveiResponse = JSON.parse(currentBasket.custom.nuveiResponseToHash);
    const forReturn = {
        step: 'empty',
        content: {
            placeOrder: Resource.msg('msg.payment.palaceorder', 'nuvei', null),
        }
    };
    const classHide = 'sfc-hidden';

    if (nuveiResponse && nuveiResponse.step) {
        forReturn.step = nuveiResponse.step;
        nuveiResponse.step = 'createOrder';
        Transaction.wrap(function () {
            currentBasket.custom.nuveiResponseToHash = JSON.stringify(nuveiResponse);
        });
    }

    return {
        data: JSON.stringify(forReturn),
        classHide: classHide
    };
};

const checkPayment = function (order) {
    const nuveiResponse = JSON.parse(order.custom.nuveiResponseToHash);
    const forReturn = {
        error: true,
        errorMessage: '',
    };

    if (nuveiResponse && nuveiResponse.data[5] === 'APPROVED') {    // nuveiResponse.data[5] == Status
        const totalAmount = order.getTotalGrossPrice().getValue().toString();

        if (totalAmount === nuveiResponse.data[1]) {    // nuveiResponse.data[1] == totalAmount
            const stringToHash = nuveiResponse.data.join('');
            const hash = checksumHelper.getRedirectChecksum(stringToHash);

            if (hash === nuveiResponse.compare) {
                forReturn.error = false;
            } else {
                forReturn.errorMessage = 'Checksum is incorrect';
            }
        } else {
            forReturn.errorMessage = 'Total amound is incorrect';
        }
    } else {
        forReturn.errorMessage = 'Payment not approved';
    }

    return forReturn;
};

const handleResponse = function (data) {
    const Transaction = require('dw/system/Transaction');
    const BasketMgr = require('dw/order/BasketMgr');
    const collectionsHelper = require('*/cartridge/scripts/nuvei/util/collections');
    const secret = nuveiPrefs.getMerchantSecretKey();
    const compare = data.advanceResponseChecksum;
    let nuveiResponse = {
        step: 'submitPayment',
        data: [
            secret, data.totalAmount, data.currency, data.responseTimeStamp, data.PPP_TransactionID, data.Status, data.productId
        ],
        compare: compare,
        error: false
    };

    const stringToHash = nuveiResponse.data.join('');

    const hash = require('*/cartridge/scripts/util/nuveiChecksumHelper').getRedirectChecksum(stringToHash);

    if (data.Status === 'APPROVED' && hash === compare) { // checksum from response is OK
        // save data for response in the order object
        var order = OrderMgr.getOrder(data.merchant_unique_id);
        const transactionType = nuveiPrefs.getTransactionType();
        const transactionId = [transactionType, data.TransactionID].join(' | ');
        const authCode = [transactionType, data.AuthCode].join(' | ');
        const merchantUniqueID = [transactionType, (data.merchant_unique_id || data.ClientUniqueId)].join(' | ');
        Transaction.wrap(function () {
            order.custom.nuveiResponseToHash = JSON.stringify(nuveiResponse);
            order.custom.nuveiMerchantUniqueID = collectionsHelper.addToSetOfStrings(order.custom.nuveiMerchantUniqueID, merchantUniqueID);
            order.custom.nuveiTransactionID = collectionsHelper.addToSetOfStrings(order.custom.nuveiTransactionID, transactionId);
            order.custom.nuveiAuthCode = collectionsHelper.addToSetOfStrings(order.custom.nuveiAuthCode, authCode);
        });
    } else {
        nuveiHelper.logger.error('Payment failed: ' + JSON.stringify(data));
        nuveiResponse = {
            error: true
        };
    }
    return nuveiResponse;
};

module.exports = {
    getRedirectSettings: getRedirectSettings,
    getResponseForFE: getResponseForFE,
    checkPayment: checkPayment,
    handleResponse: handleResponse
};
