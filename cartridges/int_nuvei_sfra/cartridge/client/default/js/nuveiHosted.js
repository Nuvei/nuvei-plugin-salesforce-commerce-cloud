module.exports.initialize = function () {
    const $submitNuveiPayment = $('.js-nuvei-submit-payment-options');
    const $placeOrderButton = $('.js-place-order');
    const $paymentInformation = $('.payment-information');
    const redirectDataUrl = $('#nuvei-group').attr('data-getdata-url');

    const NUVEI_STEPS = {
        CREATE_ORDER: 'createOrder',
        SUBMIT_PAYMENT: 'submitPayment',
    };

    const getResponse = function () {
        const nuveiResponse = $('.nuveiHandler').data('nuvei-response');

        if (!nuveiResponse) {
            return {empty: true};
        }

        return nuveiResponse;
    };

    const getCurrentStep = function (nuveiResponse) {
        const response = nuveiResponse || getResponse();

        return response.step || '';
    };

    const updateRedirectData = function () {
        // serialize forms with default SFRA
        let billingAddressForm = $('#dwfrm_billing .billing-address-block :input').serialize();
        $('body').trigger('checkout:serializeBilling', {
            form: $('#dwfrm_billing .billing-address-block'),
            data: billingAddressForm,
            callback: function (data) {
                if (data) {
                    billingAddressForm = data;
                }
            }
        });
        let contactInfoForm = $('#dwfrm_billing .contact-info-block :input').serialize();
        $('body').trigger('checkout:serializeBilling', {
            form: $('#dwfrm_billing .contact-info-block'),
            data: contactInfoForm,
            callback: function (data) {
                if (data) {
                    contactInfoForm = data;
                }
            }
        });
        const paymentForm = billingAddressForm + '&' + contactInfoForm;
        $.ajax({
            url: redirectDataUrl,
            method: 'POST',
            data: paymentForm,
            success: function (params) {
                if (!params.error.isError) {
                    if (params.type === 'iFrame') {
                        $('#nuveiIframe').attr('src', params.url);
                    }
                }
            }
        });
    };

    // on submit payment with redirection
    $submitNuveiPayment.on('click', function () {
        updateRedirectData();
    });

    // check if we have nuvei response
    const nuveiResponse = getResponse();

    $placeOrderButton.on('click', function (e) {
        const data = $(this).data();

        if ($paymentInformation.data('payment-method-id') !== 'NUVEI' || getCurrentStep(nuveiResponse) === NUVEI_STEPS.SUBMIT_PAYMENT) {
            return;
        }

        if (data.nuveiHostedPageMode) {
            e.stopPropagation();

            if (data.nuveiRedirectType === 'redirect') {
                window.location.href = data.nuveiRedirectUrl;  // URLUtils.url('Nuvei-Redirect')
            } else {
                getModalHtmlElement();
                fillModalElement(data.nuveiRedirectUrl);
            }
        }
    });

    if (!nuveiResponse.error) {
        if (getCurrentStep(nuveiResponse) === NUVEI_STEPS.SUBMIT_PAYMENT) {
            updateRedirectData();
            $paymentInformation.data('payment-method-id', 'NUVEI');
            $('.nuvei-form-content').html(nuveiResponse.content.placeOrder);
            $placeOrderButton.trigger('click');
        }
    }

    const parseHtml = function (html) {
        const $html = $('<div>').append($.parseHTML(html));

        const body = $html.find('.nuvei-iframe-container');

        return {body: body};
    };

    const getModalHtmlElement = function () {
        if ($('#nuveiModal').length !== 0) {
            $('#nuveiModal').remove();
        }
        const htmlString = '<!-- Modal -->'
            + '<div class="modal fade" id="nuveiModal" role="dialog">'
            + '<span class="enter-message sr-only" ></span>'
            + '<div class="modal-dialog nuvei-dialog">'
            + '<!-- Modal content-->'
            + '<div class="modal-content">'
            + '<div class="modal-header">'
            + '    <button type="button" class="close pull-right" data-dismiss="modal">'
            + '        <span aria-hidden="true">&times;</span>'
            + '        <span class="sr-only"> </span>'
            + '    </button>'
            + '</div>'
            + '<div class="modal-body"></div>'
            + '<div class="modal-footer"></div>'
            + '</div>'
            + '</div>'
            + '</div>';
        $('body').append(htmlString);
    };

    const fillModalElement = function (selectedValueUrl) {
        $('.modal-body').spinner().start();
        $.ajax({
            url: selectedValueUrl,
            method: 'GET',
            dataType: 'json',
            success: function (data) {
                const parsedHtml = parseHtml(data.renderedTemplate);

                $('.modal-body').empty();
                $('.modal-body').html(parsedHtml.body);
                $('#nuveiModal .modal-header .close .sr-only').text(data.closeButtonText);
                $('#nuveiModal .enter-message').text(data.enterDialogMessage);
                $('#nuveiModal').modal('show');

                $.spinner().stop();
            },
            error: function () {
                $.spinner().stop();
            }
        });
    };
};
