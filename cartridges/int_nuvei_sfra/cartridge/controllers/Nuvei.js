'use strict';
/* globals session */

const BasketMgr = require('dw/order/BasketMgr');
const Transaction = require('dw/system/Transaction');
const URLUtils = require('dw/web/URLUtils');
const Resource = require('dw/web/Resource');
var OrderMgr = require('dw/order/OrderMgr');

const server = require('server');
const csrfProtection = require('*/cartridge/scripts/middleware/csrf');
const nuveiServices = require('*/cartridge/scripts/nuveiServices');
const nuveiHelper = require('*/cartridge/scripts/util/nuveiHelper');
const nuveiHelperHosted = require('*/cartridge/scripts/util/nuveiHelperHosted');
var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');

server.post('DMN', function (req, res, next) {
    let statusCode = 500;

    if (nuveiHelper.verifyDMN(req.httpParameterMap)) {
        if (nuveiHelper.createNotification(req.httpParameterMap)) {
            statusCode = 200;
        }
    }

    res.setStatusCode(statusCode);
    res.json({});
    next();
});

server.get('OrderOpen', server.middleware.https, function (req, res, next) {
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
        dataJson.clientUniqueId = resOrderOpen.clientUniqueId;
        dataJson.userTokenId = resOrderOpen.userTokenId;
        dataJson.email = basket.getCustomerEmail();
        dataJson.error = false;
    }

    res.json(dataJson);

    next();
});

server.post(
    'HostedPaymentFormData',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
        const paymentForm = server.forms.getForm('billing');
        // verify billing form data
        const billingFormErrors = COHelpers.validateBillingForm(paymentForm.addressFields);
        const contactInfoFormErrors = COHelpers.validateFields(paymentForm.contactInfoFields);
        const billingInfo = {};

        const currentBasket = BasketMgr.getCurrentBasket();

        const formFieldErrors = [];
        if (Object.keys(billingFormErrors).length) {
            formFieldErrors.push(billingFormErrors);
        } else {
            billingInfo.address = {
                firstName: paymentForm.addressFields.firstName.value,
                lastName: paymentForm.addressFields.lastName.value,
                address1: paymentForm.addressFields.address1.value,
                address2: paymentForm.addressFields.address2.value,
                city: paymentForm.addressFields.city.value,
                postalCode: paymentForm.addressFields.postalCode.value,
                countryCode: paymentForm.addressFields.country.value
            };

            if (Object.prototype.hasOwnProperty.call(paymentForm.addressFields, 'states')) {
                billingInfo.address.stateCode = paymentForm.addressFields.states.stateCode.value;
            }
        }

        if (Object.keys(contactInfoFormErrors).length) {
            formFieldErrors.push(contactInfoFormErrors);
        } else {
            billingInfo.contact = {
                email: currentBasket.getCustomerEmail(),
                phone: paymentForm.contactInfoFields.phone.value
            };
        }

        // get redirect settings
        const redirectSettings = nuveiHelperHosted.getRedirectSettings(true, billingInfo);

        res.json(redirectSettings);
        next();
    }
);

server.post('Redirect', function (req, res, next) {
    var currentBasket = BasketMgr.getCurrentBasket();
    if (!currentBasket) {
        res.json({
            redirectUrl: URLUtils.url('Cart-Show').toString()
        });
        return next();
    }

    var order = COHelpers.createOrder(currentBasket);
    if (!order) {
        res.json({
            redirectUrl: URLUtils.url('Cart-Show').toString()
        });
        return next();
    }

    res.setViewData({
        orderID: order.getOrderNo(),
        orderToken: order.getOrderToken()
    });

    // Store the orderNo in session storage to enable
    // recreation of the basket in case of an order failure
    session.privacy.orderNo = order.orderNo;

    var redirectSettings = nuveiHelperHosted.getRedirectSettings(true, null, order.getOrderNo());

    res.json({
        redirectUrl: redirectSettings.url
    });
    return next();
});

server.get('ShowIframe', function (req, res, next) {
    const renderTemplateHelper = require('*/cartridge/scripts/renderTemplateHelper');

    var currentBasket = BasketMgr.getCurrentBasket();
    if (!currentBasket) {
        res.json({
            redirectUrl: URLUtils.url('Cart-Show').toString()
        });
        return next();
    }

    var order = COHelpers.createOrder(currentBasket);
    if (!order) {
        res.json({
            redirectUrl: URLUtils.url('Cart-Show').toString()
        });
        return next();
    }

    var orderNo = order.getOrderNo();
    // Store the orderNo in session storage to enable
    // recreation of the basket in case of an order failure
    session.privacy.orderNo = orderNo;
    const redirectSettings = nuveiHelperHosted.getRedirectSettings(true, null, orderNo);
    var redirectUrl = redirectSettings.url;

    const context = {
        redirectSettings: redirectSettings,
        closeButtonText: Resource.msg('link.quickview.close', 'product', null),
        enterDialogMessage: Resource.msg('msg.enter.quickview', 'product', null),
        orderNo: orderNo
    };
    const renderedTemplate = renderTemplateHelper.getRenderedHtml(context, 'checkout/billing/nuveiIframe');

    res.setViewData(context);
    res.json({
        renderedTemplate: renderedTemplate
    });
    next();
});

server.get('SubmitPayment', function (req, res, next) {
    const nuveiPrefs = require('*/cartridge/scripts/nuveiPreferences');
    const isIframe = nuveiPrefs.getRedirectType() === 'iFrame';
    const data = req.querystring;
    var orderNo = data.merchant_unique_id;
    var url = URLUtils.https('Nuvei-PlaceOrder', 'orderNo', orderNo);

    // Remove orderNo from session
    nuveiHelper.resetOrderNo();

    nuveiHelperHosted.handleResponse(data);

    if (isIframe) {
        res.render('checkout/billing/nuveiIframeResponse', {
            redirect: url
        });
    } else {
        res.redirect(url);
    }

    next();
});

server.get('Back', function (req, res, next) {
    // We are using session storage here because the Nuvei API does
    // not provide response data in the event of an order failure.
    var orderNo = req.querystring.orderNo || session.privacy.orderNo;
    var order = OrderMgr.getOrder(orderNo);
    var isAjaxCall = req.querystring.ajax === '1';

    if (order) {
        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });

        if (!isAjaxCall) {
            res.render('checkout/billing/nuveiIframeResponse', {
                redirect: URLUtils.https('Checkout-Begin', 'stage', 'placeOrder')
            });
        } else {
            res.json({
                redirectUrl: URLUtils.https('Checkout-Begin', 'stage', 'placeOrder').toString()
            });
        }
    } else {
        if (!isAjaxCall) {
            res.render('checkout/billing/nuveiIframeResponse', {
                redirect: URLUtils.https('Cart-Show')
            });
        } else {
            res.json({
                redirectUrl: URLUtils.https('Cart-Show').toString()
            });
        }
    }

    // Remove orderNo from session
    nuveiHelper.resetOrderNo();

    next();
});

server.get('PlaceOrder', server.middleware.https, function (req, res, next) {
    const basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
    const hooksHelper = require('*/cartridge/scripts/helpers/hooks');
    const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    const validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');
    var addressHelpers = require('*/cartridge/scripts/helpers/addressHelpers');

    var orderNo = req.querystring.orderNo;
    var order = OrderMgr.getOrder(orderNo);

    if (!order) {
        res.redirect(URLUtils.url('Cart-Show'));

        return next();
    }

    var validatedProducts = validationHelpers.validateProducts(order);
    if (validatedProducts.error) {
        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });

        res.redirect(URLUtils.url('Cart-Show'));

        return next();
    }

    if (req.session.privacyCache.get('fraudDetectionStatus')) {
        res.redirect(URLUtils.url('Error-ErrorCode', 'err', '01'));

        return next();
    }

    var validationOrderStatus = hooksHelper('app.validate.order', 'validateOrder', order, require('*/cartridge/scripts/hooks/validateOrder').validateOrder);
    if (validationOrderStatus.error) {
        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });

        res.redirect(
            URLUtils.https(
                'Checkout-Begin',
                'stage', 'placeOrder',
                'error', 'true',
                'errorMessage', validationOrderStatus.message
            ));

        return next();
    }

    // Check to make sure there is a shipping address
    if (order.defaultShipment.shippingAddress === null) {
        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });

        res.redirect(
            URLUtils.https('Checkout-Begin',
                'stage', 'shipping',
                'error', 'true',
                'errorMessage', Resource.msg('error.no.shipping.address', 'checkout', null)
            ));

        return next();
    }

    // Check to make sure billing address exists
    if (!order.billingAddress) {
        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });

        res.redirect(
            URLUtils.https('Checkout-Begin',
                'stage', 'payment',
                'error', 'true',
                'errorMessage', Resource.msg('error.no.billing.address', 'checkout', null)
            ));

        return next();
    }

    // Calculate the basket
    Transaction.wrap(function () {
        basketCalculationHelpers.calculateTotals(order);
    });

    // Re-validates existing payment instruments
    var validPayment = COHelpers.validatePayment(req, order);
    if (validPayment.error) {
        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });

        res.redirect(
            URLUtils.https('Checkout-Begin',
                'stage', 'payment',
                'error', 'true',
                'errorMessage', Resource.msg('error.payment.not.valid', 'checkout', null)
            ));

        return next();
    }

    // Re-calculate the payments.
    var calculatedPaymentTransactionTotal = COHelpers.calculatePaymentTransaction(order);
    if (calculatedPaymentTransactionTotal.error) {
        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });

        res.redirect(
            URLUtils.https('Checkout-Begin',
                'stage', 'placeOrder',
                'error', 'true',
                'errorMessage', Resource.msg('error.technical', 'checkout', null)
            ));

        return next();
    }

    // Handles payment authorization
    var handlePaymentResult = COHelpers.handlePayments(order, order.orderNo); // es-lint disable line

    // Handle custom processing post authorization
    var options = {
        req: req,
        res: res
    };

    if (handlePaymentResult.error) {
        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });

        res.redirect(URLUtils.https('Checkout-Begin',
            'stage', 'placeOrder',
            'error', 'true',
            'errorMessage', Resource.msg('error.technical', 'checkout', null)
        ));

        return next();
    }

    var fraudDetectionStatus = hooksHelper('app.fraud.detection', 'fraudDetection', order, require('*/cartridge/scripts/hooks/fraudDetection').fraudDetection);
    if (fraudDetectionStatus.status === 'fail') {
        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });

        // fraud detection failed
        req.session.privacyCache.set('fraudDetectionStatus', true);

        res.redirect(URLUtils.https('Checkout-Begin',
            'stage', 'payment',
            'error', 'true',
            'cartError', 'true',
            'redirectUrl', URLUtils.url('Error-ErrorCode', 'err', fraudDetectionStatus.errorCode).toString(),
            'errorMessage', Resource.msg('error.technical', 'checkout', null)
        ));

        return next();
    }

    // Places the order
    var placeOrderResult = COHelpers.placeOrder(order, fraudDetectionStatus);
    if (placeOrderResult.error) {
        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });

        res.redirect(URLUtils.https('Checkout-Begin',
            'stage', 'placeOrder',
            'error', 'true',
            'errorMessage', Resource.msg('error.technical', 'checkout', null)
        ));
        return next();
    }

    if (req.currentCustomer.addressBook) {
        // save all used shipping addresses to address book of the logged in customer
        var allAddresses = addressHelpers.gatherShippingAddresses(order);
        allAddresses.forEach(function (address) {
            if (!addressHelpers.checkIfAddressStored(address, req.currentCustomer.addressBook.addresses)) {
                addressHelpers.saveAddress(address, req.currentCustomer, addressHelpers.generateAddressName(address));
            }
        });
    }

    if (order.getCustomerEmail()) {
        COHelpers.sendConfirmationEmail(order, req.locale.id);
    }

    // Reset usingMultiShip after successful Order placement
    req.session.privacyCache.set('usingMultiShipping', false);

    // TODO: Exposing a direct route to an Order, without at least encoding the orderID
    //  is a serious PII violation.  It enables looking up every customers orders, one at a
    //  time.
    res.redirect(URLUtils.https('Order-Confirm',
        'error', 'false',
        'ID', order.orderNo,
        'token', order.orderToken
    ));

    return next();
});

module.exports = server.exports();
