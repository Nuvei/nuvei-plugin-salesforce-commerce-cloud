'use strict';
/* globals session */

const BasketMgr = require('dw/order/BasketMgr');
const Transaction = require('dw/system/Transaction');
const URLUtils = require('dw/web/URLUtils');
const Resource = require('dw/web/Resource');

const server = require('server');
const csrfProtection = require('*/cartridge/scripts/middleware/csrf');
const nuveiServices = require('*/cartridge/scripts/nuveiServices');
const nuveiHelper = require('*/cartridge/scripts/util/nuveiHelper');
const nuveiHelperHosted = require('*/cartridge/scripts/util/nuveiHelperHosted');

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
                email: paymentForm.contactInfoFields.email.value,
                phone: paymentForm.contactInfoFields.phone.value
            };
        }

        // get redirect settings
        const redirectSettings = nuveiHelperHosted.getRedirectSettings(true, billingInfo);

        res.json(redirectSettings);
        next();
    }
);

server.get('Redirect', function (req, res, next) {
    const redirectSettings = nuveiHelperHosted.getRedirectSettings(true);
    res.redirect(redirectSettings.url);
    next();
});

server.get('ShowIframe', function (req, res, next) {
    const renderTemplateHelper = require('*/cartridge/scripts/renderTemplateHelper');
    const redirectSettings = nuveiHelperHosted.getRedirectSettings(true);
    const context = {
        redirectSettings: redirectSettings,
        closeButtonText: Resource.msg('link.quickview.close', 'product', null),
        enterDialogMessage: Resource.msg('msg.enter.quickview', 'product', null)
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
    const url = URLUtils.https('Nuvei-PlaceOrder');

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
    res.render('checkout/billing/nuveiIframeResponse', {
        redirect: URLUtils.https('Checkout-Begin', 'stage', 'placeOrder')
    });

    next();
});

server.get('PlaceOrder', server.middleware.https, function (req, res, next) {
    const basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
    const hooksHelper = require('*/cartridge/scripts/helpers/hooks');
    const COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    const validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');

    const currentBasket = BasketMgr.getCurrentBasket();

    if (!currentBasket) {
        res.redirect(URLUtils.url('Cart-Show'));

        return next();
    }

    const validatedProducts = validationHelpers.validateProducts(currentBasket);
    if (validatedProducts.error) {
        res.redirect(URLUtils.url('Cart-Show'));

        return next();
    }

    if (req.session.privacyCache.get('fraudDetectionStatus')) {
        res.redirect(URLUtils.url('Error-ErrorCode', 'err', '01'));

        return next();
    }

    const validationOrderStatus = hooksHelper('app.validate.order', 'validateOrder', currentBasket, require('*/cartridge/scripts/hooks/validateOrder').validateOrder);
    if (validationOrderStatus.error) {
        nuveiHelper.setErrorMessage(validationOrderStatus.message);
        res.redirect(URLUtils.https('Checkout-Begin', 'stage', 'placeOrder'));

        return next();
    }

    // Check to make sure there is a shipping address
    if (currentBasket.defaultShipment.shippingAddress === null) {
        nuveiHelper.setErrorMessage(Resource.msg('error.no.shipping.address', 'checkout', null));
        res.redirect(URLUtils.https('Checkout-Begin', 'stage', 'shipping'));

        return next();
    }

    // Check to make sure billing address exists
    if (!currentBasket.billingAddress) {
        nuveiHelper.setErrorMessage(Resource.msg('error.no.billing.address', 'checkout', null));
        res.redirect(URLUtils.https('Checkout-Begin', 'stage', 'payment'));

        return next();
    }

    // Calculate the basket
    Transaction.wrap(function () {
        basketCalculationHelpers.calculateTotals(currentBasket);
    });

    // Re-validates existing payment instruments
    const validPayment = COHelpers.validatePayment(req, currentBasket);
    if (validPayment.error) {
        nuveiHelper.setErrorMessage(Resource.msg('error.payment.not.valid', 'checkout', null));
        res.redirect(URLUtils.https('Checkout-Begin', 'stage', 'payment'));

        return next();
    }

    // Re-calculate the payments.
    const calculatedPaymentTransactionTotal = COHelpers.calculatePaymentTransaction(currentBasket);
    if (calculatedPaymentTransactionTotal.error) {
        nuveiHelper.setErrorMessage(Resource.msg('error.technical', 'checkout', null));
        res.redirect(URLUtils.https('Checkout-Begin', 'stage', 'placeOrder'));

        return next();
    }

    // Creates a new order.
    const order = COHelpers.createOrder(currentBasket);
    if (!order) {
        nuveiHelper.setErrorMessage(Resource.msg('error.technical', 'checkout', null));
        res.redirect(URLUtils.https('Checkout-Begin', 'stage', 'placeOrder'));

        return next();
    }

    // Handles payment authorization
    const handlePaymentResult = COHelpers.handlePayments(order, order.orderNo);

    // Handle custom processing post authorization
    const options = {
        req: req,
        res: res
    };
    const postAuthCustomizations = hooksHelper('app.post.auth', 'postAuthorization', handlePaymentResult, order, options, require('*/cartridge/scripts/hooks/postAuthorizationHandling').postAuthorization);
    if (postAuthCustomizations && Object.prototype.hasOwnProperty.call(postAuthCustomizations, 'error')) {
        res.json(postAuthCustomizations);

        res.redirect(URLUtils.https('Order-Confirm',
            'ID', order.orderNo,
            'token', order.orderToken));

        return next();
    }

    nuveiHelper.setErrorMessage(Resource.msg('error.technical', 'checkout', null));
    res.redirect(URLUtils.https('Checkout-Begin', 'stage', 'placeOrder'));

    return next();
});

module.exports = server.exports();
