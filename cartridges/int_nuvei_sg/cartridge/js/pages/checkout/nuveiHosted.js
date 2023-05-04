var dialog = require('../../dialog');

document.addEventListener('DOMContentLoaded', function () {

    var $submitDefault = $('.js-nuvei-submit-default');
    var $submitNuveiBilling = $('.js-nuvei-submit-iframe');
    var $selectedPaymentMethodID = $('input[name$="_selectedPaymentMethodID"]');

    function getSelectedPayment () {
        return $('input[name$="_selectedPaymentMethodID"]:checked').val();
    }

    function toggleButtons () {
        if (getSelectedPayment() === 'NUVEI') {
            $submitDefault.hide();
            $submitNuveiBilling.show();
        } else {
            $submitDefault.show();
            $submitNuveiBilling.hide();
        }
    }

    // onload
    toggleButtons();
    $selectedPaymentMethodID.on('change', function () {
        toggleButtons();
    });

    $submitNuveiBilling.on('click', function (e) {
        if ($(this).data('redirectType') !== 'iFrame' || $(this).data('redirectMode') === 'Direct') {
            return;
        }

        e.preventDefault();
        var showiframeUrl = $(this).data('showiframe-url');
        var handleBillingAddressUrl = $(this).data('handlebilling-url');
        var form = $(this).closest('form');
            // serialize
        var ajaxOptions = {
            url: handleBillingAddressUrl,
            method: 'POST',
            cache: false,
            data: form.serialize()
        };
        $.ajax(ajaxOptions).done(function () {
            // show popup
            dialog.open({
                target: this.$container,
                url: showiframeUrl,
                options: {
                    width: 980,
                    title: 'Nuvei'
                }
            });
        });
    });
});
