/* global SafeCharge */
/* eslint-disable no-underscore-dangle */
(function () {

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
        this.$errorMessage = $('.error-message');
        this.$submitButtons = $('.js-nuvei-billing-submit-buttons');
        this.$savedPayments = $('#nuveiCardList');

        this.ScFields = this.sfchInstance.fields({
            fonts: [
                {cssUrl: 'https://fonts.googleapis.com/css?family=Roboto'}, // include your custom fonts
            ]
        });

        this.$countryCode = $('.addressSelector.form-control option[selected]');

        this.clearError();
        this._initCCFields();

        this.$paymentMethodsBlock.on('change', 'input[type=radio]', function (evt) {
            this.selectedPaymentMethod = evt.target.value;
        }.bind(this));
    };

    Sfch.prototype._getFieldStyles = function () {
        return {
            base: {
                color: '#333333',
                fontWeight: '400',
                fontSize: '12px',
                '::placeholder': {
                    color: '#333333',
                },
                ':-webkit-autofill': {
                    color: '#333333',
                }
            },
            invalid: {
                color: '#990000',
                '::placeholder': {
                    color: '#333333',
                },
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

        this.creditCard = {};

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
            $paymentMethod.addClass('form-row form-indent label-inline js-nuvei-apm');

            const id = radioName + '_' + paymentMethod.paymentMethod;
            const $radio = $('<input type="radio" />');
            $radio.addClass('sfc-check-input');
            $radio.val(paymentMethod.paymentMethod);
            $radio.attr('name', radioName);
            $radio.attr('id', id);

            if (this.selectedPaymentMethod === paymentMethod.paymentMethod) {
                $radio.attr('checked', 'checked');
            }

            $paymentMethod.append($radio);

            const $label = $('<label/>');
            $label.attr('for', id);
            $label.html('<span class="sfc-name">' + this._getDisplayName(paymentMethod.paymentMethodDisplayName) + '</span>');

            if (paymentMethod.logoURL) {
                const $img = $('<img/>');
                $img.addClass('sfc-logo-img');
                $img.attr('src', paymentMethod.logoURL);
                $label.prepend($img);
            }

            $paymentMethod.append($label);

            paymentMethod.fields.forEach(function (field) {
                const name = [paymentMethod.paymentMethod, field.name].join('_');
                const $row = $('<div/>');
                const $input = $('<input/>');
                let placeholder = this._getCaption(field);

                if (paymentMethod.paymentMethod === 'apmgw_Neteller') {
                    placeholder = this._fixNeteller(placeholder);
                }

                $input.addClass('SfcField');
                $input.attr('name', name);
                $input.data('name', field.name);
                $input.attr('placeholder', placeholder)

                if (field.regex) {
                    $input.data('regex', field.regex);
                }

                $row.addClass('sfc-input field-wrapper');
                $row.append($input);

                $paymentMethod.append($row);
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
            countryCode: $('#dwfrm_billing_billingAddress_addressFields_country').val().toUpperCase(),
            sessionToken: this.config.sessionToken
        };
        this.sfchInstance.getApms(params, function (resAPM) {
            if (resAPM.status === 'SUCCESS') {
                this._renderAPM(resAPM.paymentMethods);
            }
        }.bind(this));
    };

    Sfch.prototype.isValid = function () {
        if (this.selectedPaymentMethod === this.CREDIT_CARD_FIELD_NAME) {
            if (this.$savedPayments.length > 0 && this.$savedPayments.val() !== 'NEW_CREDIT_CARD') {
                const $cvvElement = $('#saved-card-cvc');
                if ($cvvElement.val() === '') {
                    $cvvElement.trigger('focus');
                    return false;
                }
            } else {
                const fields = Object.values(this.creditCard);

                if (this.$CCHolderName.val().length === 0) {
                    this.$CCHolderName.trigger('focus');
                    return false;
                }

                for (let i = 0; i < fields.length; i++) {
                    const field = fields[i];
                    if (!field.valid) {
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
        this.$errorMessage.text(message).show();
    };

    Sfch.prototype.clearError = function () {
        this.$errorMessage.hide().text('');
    };

    Sfch.prototype.getPaymentOption = function () {
        let paymentOption = {};
        if (this.selectedPaymentMethod === this.CREDIT_CARD_FIELD_NAME) {
            if (this.$savedPayments.length > 0 && this.$savedPayments.val() !== 'NEW_CREDIT_CARD') {
                paymentOption = {
                    userPaymentOptionId: this.$savedPayments.val(),
                    card: {
                        CVV: $('#saved-card-cvc').val()
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

    document.addEventListener('DOMContentLoaded', function () {
        const NUVEI_PAYMENT_METHOD = 'NUVEI';
        const RESPONSE_STATUSES = {
            APPROVED: 'APPROVED',
            DECLINED: 'DECLINED',
            ERROR: 'ERROR',
        };

        const sfch = new Sfch();
        sfch.getAPMs();

        let nuveiPassed = false;

        $('#dwfrm_billing').on('submit', function (evt) {
            const isNuvei = $('.payment-method.payment-method-expanded').data('method') === NUVEI_PAYMENT_METHOD;
            const $form = $(this);

            sfch.clearError();

            if (isNuvei && !nuveiPassed) {
                evt.preventDefault();

                if (!sfch.isValid() || !$(this).valid()) {
                    return;
                }

                sfch.$submitButtons.hide();

                $.ajax({
                    url: sfch.config.orderOpenUrl,
                    dataType: 'json',
                    success: function (res) {
                        const email = $('#dwfrm_billing_billingAddress_email_emailAddress').val();
                        const country = $('#dwfrm_billing_billingAddress_addressFields_country').val().toUpperCase();

                        if (res.error) {
                            sfch.showError(sfch.config.paymentNotValid);
                            sfch.$submitButtons.show();
                            return;
                        }

                        const paymentParams = {
                            sessionToken: res.sessionToken,
                            clientUniqueId: res.clientUniqueId,
                            cardHolderName: sfch.$CCHolderName.val(),
                            paymentOption: sfch.getPaymentOption(),
                            billingAddress: {email, country}
                        };

                        if (res.userTokenId) {
                            paymentParams.userTokenId = res.userTokenId;
                        }

                        sfch.sfchInstance.createPayment(paymentParams, function (paymentCreateResponse) {
                            if (paymentCreateResponse.result !== RESPONSE_STATUSES.APPROVED) {
                                sfch.$submitButtons.show();
                                sfch.showError(sfch.config.paymentNotValid);
                                return;
                            }

                            nuveiPassed = true;
                            $form.trigger('submit');
                        });
                    },
                    error: function () {
                        sfch.$submitButtons.show();
                    },
                });

                return;
            }
        });

        // select credit card from list
        $('#nuveiCardList').on('change', function () {
            const cardToken = $(this).val();
            const newCardForm = $('.js-nuvei-new-card');
            const savedCardCVC = $('.js-nuvei-saved-card-cvc');
            if (cardToken === 'NEW_CREDIT_CARD') {
                newCardForm.removeClass('sfc-hidden');
                savedCardCVC.addClass('sfc-hidden');
            } else {
                newCardForm.addClass('sfc-hidden');
                savedCardCVC.removeClass('sfc-hidden');
            }
        });
    });
})();
