'use strict';

const Transaction = require('dw/system/Transaction');
const OrderMgr = require('dw/order/OrderMgr');

const NuveiHelper = require('*/cartridge/scripts/util/nuveiHelper');

const baseCheckoutHelpers = module.superModule;

/**
* Attempts to create an order from the current basket
* @param {dw.order.Basket} currentBasket - The current basket
* @returns {dw.order.Order} The order object created from the current basket
*/
const createOrder = function (currentBasket) {
    const orderNo = NuveiHelper.getOrderNo();
    let order;

    try {
        order = Transaction.wrap(function () {
            return OrderMgr.createOrder(currentBasket, orderNo);
        });

        NuveiHelper.resetOrderNo();
    } catch (error) {
        return null;
    }
    return order;
};

module.exports = baseCheckoutHelpers;
module.exports.createOrder = createOrder;
