var chai = require('chai');
var config = require('../it.config');
var request = require('request-promise').defaults({ simple: false });
var chaiSubset = require('chai-subset');
var assert = chai.assert;
var baseUrl = config.baseUrl;
chai.use(chaiSubset);
var cookieJar = request.jar();

describe('Nuvei-HostedPaymentFormData', function () {
    describe('When integration gets hosted payment form data', function () {
        var myRequest = {
            url: '',
            method: 'POST',
            rejectUnauthorized: false,
            resolveWithFullResponse: true,
            jar: cookieJar,
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        };

        var cookieString;


        var variantPid1 = '701643421084M';
        var qty1 = 2;
        var addProd = '/Cart-AddProduct';

        // ----- Step 1 adding product to Cart
        myRequest.url = baseUrl + addProd;
        myRequest.form = {
            pid: variantPid1,
            quantity: qty1
        };
        before(function () {
            return request(myRequest)
                .then(function (addToCartResponse) {
                    assert.equal(addToCartResponse.statusCode, 200, 'Expected add to Cart request statusCode to be 200.');
                    cookieString = cookieJar.getCookieString(myRequest.url);
                    myRequest.url = baseUrl + '/CSRF-Generate';
                    var cookie = request.cookie(cookieString);
                    cookieJar.setCookie(cookie, myRequest.url);
                    // step2 : get cookies, Generate CSRF, then set cookies
                    return request(myRequest);
                })
                .then(function (csrfResponse) {
                    var csrfJsonResponse = JSON.parse(csrfResponse.body);
                    // step3 : submit billing request with token aquired in step 2
                    myRequest.url = baseUrl + '/CheckoutServices-SubmitPayment?' +
                        csrfJsonResponse.csrf.tokenName + '=' +
                        csrfJsonResponse.csrf.token;
                    myRequest.form = {
                        dwfrm_billing_shippingAddressUseAsBillingAddress: 'true',
                        dwfrm_billing_addressFields_firstName: 'John',
                        dwfrm_billing_addressFields_lastName: 'Smith',
                        dwfrm_billing_addressFields_address1: '10 main St',
                        dwfrm_billing_addressFields_address2: '',
                        dwfrm_billing_addressFields_country: 'us',
                        dwfrm_billing_addressFields_states_stateCode: 'MA',
                        dwfrm_billing_addressFields_city: 'burlington',
                        dwfrm_billing_addressFields_postalCode: '09876',
                        dwfrm_billing_paymentMethod: 'CREDIT_CARD',
                        dwfrm_billing_creditCardFields_cardType: 'Visa',
                        dwfrm_billing_creditCardFields_cardNumber: '4111111111111111',
                        dwfrm_billing_creditCardFields_expirationMonth: '2',
                        dwfrm_billing_creditCardFields_expirationYear: '2030.0',
                        dwfrm_billing_creditCardFields_securityCode: '342',
                        dwfrm_billing_contactInfoFields_email: 'blahblah@gmail.com',
                        dwfrm_billing_contactInfoFields_phone: '9786543213'
                    };
                    return request(myRequest);
                });
        });

        it('should successfully get HostedPaymentFormData', function () {
            // Generate CSRF
            myRequest.url = baseUrl + '/CSRF-Generate';
            return request(myRequest)
                .then(function (csrfResponse) {
                    var csrfJsonResponse = JSON.parse(csrfResponse.body);
                    myRequest.url = baseUrl + '/Nuvei-HostedPaymentFormData?' +
                    csrfJsonResponse.csrf.tokenName + '=' +
                    csrfJsonResponse.csrf.token;
                    return request(myRequest);
                })
                .then(function (response) {
                    var bodyAsJson = JSON.parse(response.body);
                    assert.equal(response.statusCode, 200, 'Expected CheckoutServices-SubmitPayment statusCode to be 200.');
                    assert.isTrue(bodyAsJson.enabled);
                    if (bodyAsJson.mode === 'Hosted Page') {
                        assert.isNotNull(bodyAsJson.url);
                    }
                });
        });
    });
});
