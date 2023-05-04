'use strict';

const URLUtils = require('dw/web/URLUtils');

const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
const nuveiHelper = require('*/cartridge/scripts/util/nuveiHelper');

/**
 * This function is to handle the post payment authorization customizations
 * @param {Object} result - Authorization Result
 * @param {dw.order.Order} order - The current user's order
 * @param {Object} options - additional options
 * @param {Object} option.req - request instance
 * @return {boolean|Object} - result of post-authorization
 */
function postAuthorization(result, order, options) {
    if (nuveiHelper.isNuvei(order)) {
        if (order.getCustomerEmail()) {
            COHelpers.sendConfirmationEmail(order, options.req.locale.id);
        }

        return {
            error: false,
            orderID: order.orderNo,
            orderToken: order.orderToken,
            continueUrl: URLUtils.url('Order-Confirm').toString()
        };
    }

    return false;
}

exports.postAuthorization = postAuthorization;
