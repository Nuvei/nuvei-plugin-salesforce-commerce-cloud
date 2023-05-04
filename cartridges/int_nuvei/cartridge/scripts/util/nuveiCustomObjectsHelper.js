'use strict';

const Calendar = require('dw/util/Calendar');
const CustomObjectMgr = require('dw/object/CustomObjectMgr');
const Order = require('dw/order/Order');
const OrderMgr = require('dw/order/OrderMgr');
const StringUtils = require('dw/util/StringUtils');
const Transaction = require('dw/system/Transaction');

const nuveiHelper = require('~/cartridge/scripts/util/nuveiHelper');

const CUSTOM_OBJECT_TYPE = 'nuveiDirectMerchantNotification';

/**
 * Returns object from http parameters
 * @param {dw.web.HttpParameterMap} parameterMap - request parameter map
 * @returns {Object} - object
 */
const parameterToObject = function (parameterMap) {
    const object = {};
    const parameters = parameterMap.getParameterNames().iterator();

    while (parameters.hasNext()) {
        let key = parameters.next();
        let parameter = parameterMap[key];

        if (!parameter.empty) {
            object[key] = parameter.value;
        }
    }

    return object;
};

const create = function (parameterMap) {
    return Transaction.wrap(function () {
        const paymentData = parameterToObject(parameterMap);
        const orderNo = paymentData.merchant_unique_id || paymentData.clientRequestId;
        const keyValue = orderNo.concat('-').concat(StringUtils.formatCalendar(new Calendar(), 'yyyyMMddhhmmssSSS'));
        const customObj = CustomObjectMgr.createCustomObject(CUSTOM_OBJECT_TYPE, keyValue);

        customObj.custom.paymentDetails = JSON.stringify(paymentData);
    });
};

const getAll = function () {
    return CustomObjectMgr.getAllCustomObjects(CUSTOM_OBJECT_TYPE);
};

const handle = function (customObj) {
    const result = {
        placed: false,
        remove: false,
    };
    const orderNo = customObj.custom.orderNo.split('-', 1);
    const order = OrderMgr.getOrder(orderNo);
    const paymentDetails = JSON.parse(customObj.custom.paymentDetails);
    const currency = paymentDetails.currency;
    const amount = paymentDetails.totalAmount;
    const status = paymentDetails.ppp_status;
    const transaction = [
        paymentDetails.PPP_TransactionID,
        paymentDetails.message
    ];
    const creditCard = {
        holderName: paymentDetails.nameOnCard,
        number: paymentDetails.cardNumber,
        expMonth: paymentDetails.expMonth,
        expYear: paymentDetails.expYear,
    };

    if (!order) {
        return result;
    }

    if (order.getStatus().getValue() !== Order.ORDER_STATUS_CREATED) {
        result.remove = true;
        return result;
    }

    const totalGrossPrice = order.getTotalGrossPrice();

    if (totalGrossPrice.getCurrencyCode() !== currency || totalGrossPrice.getValue().toString() !== amount) {
        result.remove = true;
        return result;
    }

    const paymentInstrument = nuveiHelper.getPaymentInstrument(order);

    if (!paymentInstrument) {
        result.remove = true;
        return result;
    }

    paymentInstrument.setCreditCardHolder(creditCard.holderName);
    paymentInstrument.setCreditCardNumber(creditCard.number);
    paymentInstrument.setCreditCardExpirationMonth(+creditCard.expMonth);
    paymentInstrument.setCreditCardExpirationYear(+creditCard.expYear);

    order.addNote('DMN', transaction.join(' | '));

    if (status === 'OK') {
        OrderMgr.placeOrder(order);

        if (paymentDetails.transactionType === 'Sale') {
            order.setPaymentStatus(order.PAYMENT_STATUS_PAID);
        }

        order.setConfirmationStatus(order.CONFIRMATION_STATUS_CONFIRMED);
        order.setExportStatus(order.EXPORT_STATUS_READY);
        result.placed = true;
    } else {
        OrderMgr.failOrder(order);
    }

    result.remove = true;
    return result;
};

const remove = function (customObj) {
    CustomObjectMgr.remove(customObj);
};

module.exports = {
    create: create,
    getAll: getAll,
    handle: handle,
    remove: remove,
};
