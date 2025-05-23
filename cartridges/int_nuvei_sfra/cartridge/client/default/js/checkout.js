const processInclude = require('base/util');
const cleave = require('base/components/cleave');

const baseBilling = require('base/checkout/billing');

/**
 * Validate and update payment instrument form fields
 * @param {Object} order - the order model
 */
baseBilling.methods.validateAndUpdateBillingPaymentInstrument = function (order) {
    var billing = order.billing;
    if (!billing.payment || !billing.payment.selectedPaymentInstruments
        || billing.payment.selectedPaymentInstruments.length <= 0) return;

    var form = $('form[name=dwfrm_billing]');
    if (!form) return;
};

/**
 * Updates payment summary information
 * @param {Object} order - the order model
 */
baseBilling.methods.updatePaymentInformation = function (order) {
    // update payment details
    var $paymentSummary = $('.payment-details');
    var htmlToAppend = '';

    if (order.billing.payment && order.billing.payment.selectedPaymentInstruments
        && order.billing.payment.selectedPaymentInstruments.length > 0) {
        const lastSelectedPaymentIdx = order.billing.payment.selectedPaymentInstruments.length - 1;
        if (!order.billing.payment.selectedPaymentInstruments[lastSelectedPaymentIdx].maskedCreditCardNumber) {
            htmlToAppend += '<span>'
                + order.billing.payment.selectedPaymentInstruments[lastSelectedPaymentIdx].type
                + '</span>';
        } else {
            htmlToAppend += '<span>' + order.resources.cardType + ' '
                + order.billing.payment.selectedPaymentInstruments[lastSelectedPaymentIdx].type
                + '</span><div>'
                + order.billing.payment.selectedPaymentInstruments[lastSelectedPaymentIdx].maskedCreditCardNumber
                + '</div><div><span>'
                + order.resources.cardEnding + ' '
                + order.billing.payment.selectedPaymentInstruments[lastSelectedPaymentIdx].expirationMonth
                + '/' + order.billing.payment.selectedPaymentInstruments[lastSelectedPaymentIdx].expirationYear
                + '</span></div>';
        }
    }

    $paymentSummary.empty().append(htmlToAppend);
};

baseBilling.handleCreditCardNumber = function () {
    if ($('.cardNumber').length > 0) {
        cleave.handleCreditCardNumber('.cardNumber', '#cardType');
    }
};


$(document).ready(function () {
    processInclude(require('base/checkout/checkout'));
    const isDirect = $('#nuvei-group').attr('data-mode') === 'Direct';

    if (isDirect) {
        $('#selectedPaymentOption').val($('.payment-options .nav-item .active').parent().attr('data-method-id'));
        require('./nuveiDirect').initialize();
    } else {
        require('./nuveiHosted').initialize();
    }

    $('.payment-options .nav-link').on('click', function () {
        if (isDirect) {
            $('#selectedPaymentOption').val($(this).parent().attr('data-method-id'));
        }
    });

    // overridden event handlers from 'base/checkout/billing'
    $('.btn.add-payment').off('click').on('click', function (e) {
        e.preventDefault();
        $('.payment-information').data('is-new-payment', true);
        $('.credit-card-form').removeClass('checkout-hidden');
        $('.user-payment-instruments').addClass('checkout-hidden');
    });

    $('.cancel-new-payment').off('click').on('click', function (e) {
        e.preventDefault();
        $('.payment-information').data('is-new-payment', false);
        $('.user-payment-instruments').removeClass('checkout-hidden');
        $('.credit-card-form').addClass('checkout-hidden');
    });

    const errorMessage = $('.place-order').data('error-message');

    if (errorMessage) {
        $('.error-message').show();
        $('.error-message-text').text(errorMessage);
    }
});

