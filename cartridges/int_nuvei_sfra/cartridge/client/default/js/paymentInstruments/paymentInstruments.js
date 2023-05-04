const basepaymentInstruments = require('base/paymentInstruments/paymentInstruments');

basepaymentInstruments.removePayment = function () {
    $('.remove-payment').on('click', function (e) {
        e.preventDefault();

        const url = $(this).data('url') + '?UUID=' + $(this).data('id');
        $('.payment-to-remove').empty().append($(this).data('card'));

        $('.delete-confirmation-btn').on('click', function (f) {
            f.preventDefault();
            $('.remove-payment').trigger('payment:remove', f);
            $.ajax({
                url: url,
                type: 'get',
                dataType: 'json',
                success: function (data) {
                    $('#uuid-' + data.UUID).remove();
                    if (data.walletIsEmpty) {
                        var toInsert = '<div class="row justify-content-center h3 no-saved-payments"><p>' +
                        data.message +
                        '</p></div>';
                        $('.paymentInstruments').empty().append(toInsert);
                    } else {
                        const $messageBlock = $('<div/>');
                        $messageBlock.addClass('alert alert-success');
                        $messageBlock.html(data.message);
                        $('.paymentInstruments').prepend($messageBlock);

                        setTimeout(function () { $messageBlock.remove() }, 3000);
                    }
                },
                error: function (err) {
                    if (err.responseJSON.redirectUrl) {
                        window.location.href = err.responseJSON.redirectUrl;
                    }
                    $.spinner().stop();
                }
            });
        });
    });
};

module.exports = basepaymentInstruments;
