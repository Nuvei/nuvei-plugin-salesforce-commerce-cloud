/* globals SafeCharge */
/* eslint-disable  no-underscore-dangle */

if (window.opener) {
    if (!~window.opener.location.host.indexOf('salesforce.com')) {
        window.close();
    }
}

const scrollAnimate = require('base/components/scrollAnimate');
const Sfch = function () {
    this.config = $('.js-nuvei-fields').data();
    this.sfchInstance = SafeCharge({ // eslint-disable-line new-cap
        env: this.config.environment, // the environment you are running on, 'prod' for production
        merchantId: this.config.merchantId, // your Merchant ID provided by Nuvei
        merchantSiteId: this.config.merchantSiteId, // your Merchantsite ID provided by Nuvei
    });
    this.CREDIT_CARD_FIELD_NAME = 'cc_card';
    this.selectedPaymentMethod = this.CREDIT_CARD_FIELD_NAME;
    this.$paymentMethodsBlock = $('.js-nuvei-payment-methods');
    this.$creditCardForm = this.$paymentMethodsBlock.find('.credit-card-form');
    this.$savedPayments = this.$paymentMethodsBlock.find('.user-payment-instruments');

    this.ScFields = this.sfchInstance.fields({
        fonts: [
            {cssUrl: 'https://fonts.googleapis.com/css?family=Roboto'}, // include your custom fonts
        ]
    });

    this.$countryCode = $('.addressSelector.form-control option[selected]');

    this._initCCFields();

    this.$paymentMethodsBlock.on('change', 'input[type=radio]', function (evt) {
        this.selectedPaymentMethod = evt.target.value;
    }.bind(this));

    if ($('.data-checkout-stage').data('checkout-stage') !== 'shipping') {
        this.getAPMs();
    }
};

Sfch.prototype._getFieldStyles = function () {
    return {
        base: {
            color: '#212529',
            fontWeight: '400',
            // fontFamily: 'Roboto, Consolas, Menlo, monospace',
            fontSize: '16px',
            // fontSmoothing: 'antialiased',
            '::placeholder': {
                color: '#212529',
            },
            ':-webkit-autofill': {
                color: '#212529',
            }
        },
        invalid: {
            color: '#CC0000',
            '::placeholder': {
                color: '#CC0000',
            },
        },
        empty: {
            color: '#212529',
            '::placeholder': {
                color: '#212529'
            }
        },
    };
};

Sfch.prototype._getFieldClasses = function () {
    return {
        focus: 'sfc-focused',
        empty: 'sfc-empty',
        invalid: 'sfc-invalid',
        complete: 'sfc-complete',
    };
};

Sfch.prototype._initCCFields = function () {
    this.creditCard = {};
    const ccFields = [
        {
            id: '#card-number',
            name: 'ccNumber',
        },
        {
            id: '#card-expiry',
            name: 'ccExpiration',
        },
        {
            id: '#card-cvc',
            name: 'ccCvc',
        },
    ];
    const ScFieldStyles = this._getFieldStyles();
    const ScFieldClasses = this._getFieldClasses();

    ccFields.forEach(function (field) {
        this.creditCard[field.name] = {
            valid: false
        };
        this.creditCard[field.name].field = this.ScFields.create(field.name, {
            style: ScFieldStyles,
            classes: ScFieldClasses,
        });
        this.creditCard[field.name].field.attach(field.id);
        this.creditCard[field.name].field.on('change', this._onFieldChange.bind(this));
    }.bind(this));

    this.$CCHolderName = $('.js-nuvei-holder-name');
};

Sfch.prototype._onFieldChange = function (evt) {
    this.creditCard[evt.field].valid = evt.complete;
};

Sfch.prototype._renderAPM = function (paymentMethods) {
    const apmClass = 'js-nuvei-apm';
    this.$paymentMethodsBlock.find('.' + apmClass).remove();
    const radioName = this.$paymentMethodsBlock.find('input[type=radio]').attr('name');

    paymentMethods.forEach(function (paymentMethod) {
        if (paymentMethod.paymentMethod === 'cc_card') {
            return;
        }

        const $paymentMethod = $('<div/>');
        $paymentMethod.addClass('payment-item form-check form-group js-nuvei-apm');

        const id = radioName + '_' + paymentMethod.paymentMethod;
        const $radio = $('<input type="radio" />');
        $radio.val(paymentMethod.paymentMethod);
        $radio.attr('name', radioName);
        $radio.attr('id', id);
        $radio.addClass('payment-check-input form-check-input');

        if (this.selectedPaymentMethod === paymentMethod.paymentMethod) {
            $radio.attr('checked', 'checked');
        }

        $paymentMethod.append($radio);

        const $label = $('<label/>');
        $label.addClass('form-check-label');
        $label.attr('for', id);
        $label.html('<span class="sfc-name">' + this._getDisplayName(paymentMethod.paymentMethodDisplayName) + '</span>');

        if (paymentMethod.logoURL) {
            const $img = $('<img/>');
            $img.addClass('sfc-logo-img');
            $img.attr('src', paymentMethod.logoURL);
            $label.prepend($img);
        }

        $paymentMethod.append($label);

        const $row = $('<div/>');
        $row.addClass('payment-input row');
        $paymentMethod.append($row);

        paymentMethod.fields.forEach(function (field) {
            const name = [paymentMethod.paymentMethod, field.name].join('_');
            const $col = $('<div/>');
            const $input = $('<input/>');
            let placeholder = this._getCaption(field);

            if (paymentMethod.paymentMethod === 'apmgw_Neteller') {
                placeholder = this._fixNeteller(placeholder);
            }

            $input.addClass('form-control');
            $input.attr('name', name);
            $input.attr('placeholder', placeholder)
            $input.data('name', field.name);

            if (field.regex) {
                $input.data('regex', field.regex);
            }

            $col.addClass('sfc-input form-group col-md-6');
            $col.append($input);

            $row.append($col);
        }.bind(this));

        this.$paymentMethodsBlock.append($paymentMethod);
    }.bind(this));

    if (this.$paymentMethodsBlock.find('input:checked').length === 0) {
        this.$paymentMethodsBlock.find('input').first().prop('checked', true);
    }
};

Sfch.prototype._getCaption = function (field) {
    if (field.caption[0] &&
        field.caption[0].message) {
        return field.caption[0].message;
    }

    return field.name.split('_')
        .map(function (word) {
            return word[0].toUpperCase() + word.slice(1);
        })
        .join(' ');
};

Sfch.prototype._fixNeteller = function (string) {
    return string.replace('etteler', 'eteller');
};

Sfch.prototype._getDisplayName = function (displayNames, lang) {
    if (displayNames.length === 0) {
        return '';
    }

    for (let i = 0; i < displayNames.length; i++) {
        if (displayNames[i].language === lang) {
            return displayNames[i].message;
        }
    }

    return displayNames[0].message;
};

Sfch.prototype.getAPMs = function () {
    const params = {
        countryCode: $('.addressSelector.form-control option[selected]').data('country-code'),
        sessionToken: this.config.sessionToken
    };

    if (!params.countryCode) {
        params.countryCode = $('select[name=dwfrm_shipping_shippingAddress_addressFields_country]').val();
    }

    this.sfchInstance.getApms(params, function (resAPM) {
        if (resAPM.status === 'SUCCESS') {
            this._renderAPM(resAPM.paymentMethods);
        }
    }.bind(this));
};

Sfch.prototype.isValid = function () {
    if (this.selectedPaymentMethod === this.CREDIT_CARD_FIELD_NAME) {
        if (this.$creditCardForm.hasClass('checkout-hidden') && this.$savedPayments.length > 0) {
            const $cvvElement = $('.saved-payment-instrument.' +
                'selected-payment .saved-payment-security-code');
            if ($cvvElement.val() === '') {
                $cvvElement.addClass('is-invalid');
                scrollAnimate($cvvElement);
                $cvvElement.trigger('focus');
                return false;
            }
        } else {
            const fields = Object.values(this.creditCard);

            if (this.$CCHolderName.val().length === 0) {
                scrollAnimate(this.$CCHolderName);
                this.$CCHolderName.addClass('is-invalid');
                this.$CCHolderName.trigger('focus');
                return false;
            }

            for (let i = 0; i < fields.length; i++) {
                const field = fields[i];
                if (!field.valid) {
                    $(field.field.parentElm).addClass('is-invalid');
                    scrollAnimate($(field.field.parentElm));
                    field.field.focus();
                    return false;
                }
            }
        }
    } else {
        const fields = $('input[name^=' + this.selectedPaymentMethod + ']');

        for (let i = 0; i < fields.length; i++) {
            const $el = $(fields[i]);
            const value = $el.val();
            const regex = $el.data('regex');

            if (!value || (regex && !(new RegExp(regex)).test(value))) {
                $el.trigger('focus');
                return false;
            }
        }
    }

    return true;
};

Sfch.prototype.showError = function (message) {
    $('.error-message').show();
    $('.error-message-text').text(message);
};

Sfch.prototype.getPaymentOption = function () {
    let paymentOption = {};
    if (this.selectedPaymentMethod === this.CREDIT_CARD_FIELD_NAME) {
        if (this.$creditCardForm.hasClass('checkout-hidden') && this.$savedPayments.length > 0) {
            const $selectedPayment = $('.saved-payment-instrument.selected-payment');
            paymentOption = {
                userPaymentOptionId: $selectedPayment.data('savedToken'),
                card: {
                    CVV: $selectedPayment.find('.saved-payment-security-code').eq(0).val()
                }
            };
        } else {
            paymentOption = this.creditCard.ccNumber.field;
        }
    } else {
        paymentOption = {
            alternativePaymentMethod: {
                paymentMethod: this.selectedPaymentMethod
            }
        };

        const fields = $('input[name^=' + this.selectedPaymentMethod + ']');
        for (let i = 0; i < fields.length; i++) {
            const $el = $(fields[i]);

            paymentOption.alternativePaymentMethod[$el.data('name')] = $el.val();
        }
    }

    return paymentOption;
};

module.exports.initialize = function () {
    const NUVEI_CREATE_PAYMENT_BTN = 'js-nuvei-create-payment';
    const NUVEI_PAYMENT_METHOD = 'NUVEI';
    const RESPONSE_STATUSES = {
        APPROVED: 'APPROVED',
        DECLINED: 'DECLINED',
        ERROR: 'ERROR',
    };

    const sfch = new Sfch();

    const $selectedPaymentOption = $('#selectedPaymentOption');
    const $placeOrderBtn = $('.place-order');

    $('.submit-shipping').on('click', function () {
        sfch.getAPMs();
    });

    $('.submit-payment').on('click', function (evt) {
        const isNuvei = $selectedPaymentOption.val() === NUVEI_PAYMENT_METHOD;

        if (isNuvei && !sfch.isValid()) {
            evt.stopPropagation();
            return;
        }

        $placeOrderBtn.toggleClass(NUVEI_CREATE_PAYMENT_BTN, isNuvei);
    });

    $placeOrderBtn.on('click', function (evt) {
        if (!$placeOrderBtn.hasClass(NUVEI_CREATE_PAYMENT_BTN)) {
            return;
        }

        evt.stopPropagation();

        const email = $('.form-control.email').val();
        const country = $('.addressSelector.form-control option[selected]').data().countryCode;

        const config = $('.js-nuvei-fields').data();

        $.ajax({
            url: config.orderOpenUrl,
            dataType: 'json',
            success: function (resOrderCreate) {
                if (resOrderCreate.error) {
                    sfch.showError(config.paymentNotValid);
                    return;
                }

                const paymentParams = {
                    sessionToken: resOrderCreate.sessionToken,
                    clientUniqueId: resOrderCreate.clientUniqueId,
                    cardHolderName: sfch.$CCHolderName.val(),
                    paymentOption: sfch.getPaymentOption(),
                    billingAddress: {email, country}
                };

                if (resOrderCreate.userTokenId) {
                    paymentParams.userTokenId = resOrderCreate.userTokenId;
                }

                sfch.sfchInstance.createPayment(paymentParams, function (resCreatePayment) {
                    if (resCreatePayment.result !== RESPONSE_STATUSES.APPROVED) {
                        sfch.showError(config.paymentNotValid);
                        return;
                    }

                    $placeOrderBtn.removeClass(NUVEI_CREATE_PAYMENT_BTN).trigger('click');
                });
            },
        });
    });
};
/* eslint-enable */
