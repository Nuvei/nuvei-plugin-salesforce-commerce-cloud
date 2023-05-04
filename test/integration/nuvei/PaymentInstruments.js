var chai = require('chai');
var config = require('../it.config');
var request = require('request-promise').defaults({ simple: false });
var chaiSubset = require('chai-subset');
var assert = chai.assert;
var baseUrl = config.baseUrl;
chai.use(chaiSubset);
var cookieJar = request.jar();

describe('PaymentInstruments-DeletePayment', function () {
    describe('When credit card was stored in wallet', function () {
        this.timeout(20000);

        var myRequest = {
            url: '',
            method: 'GET',
            rejectUnauthorized: false,
            resolveWithFullResponse: true,
            jar: cookieJar,
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        };

        var cookieString;
        var cookie;
        var cardUUID;

        myRequest.url = baseUrl + '/Login-Show';

        before(function () {
            return request(myRequest)
                .then(function (response) {
                    assert.equal(response.statusCode, 200, 'Expected Login Page statusCode to be 200.');
                    cookieString = cookieJar.getCookieString(myRequest.url);
                })
                // get CSRF token
                .then(function () {
                    myRequest.method = 'POST';
                    myRequest.url = config.baseUrl + '/CSRF-Generate';
                    cookie = request.cookie(cookieString);
                    cookieJar.setCookie(cookie, myRequest.url);
                    return request(myRequest)
                        .then(function (csrfResponse) {
                            var csrfJsonResponse = JSON.parse(csrfResponse.body);
                            myRequest.url = config.baseUrl + '/Account-Login?rurl=1';
                            myRequest.form = {
                                loginEmail: 'testuser1@demandware.com',
                                loginPassword: 'Test123!',
                                csrf_token: csrfJsonResponse.csrf.token
                            };
                            return request(myRequest);
                        });
                })
                .then(function () {
                    myRequest.method = 'POST';
                    myRequest.url = config.baseUrl + '/CSRF-Generate';
                    cookie = request.cookie(cookieString);
                    cookieJar.setCookie(cookie, myRequest.url);
                    return request(myRequest)
                        .then(function (csrfResponse) {
                            var csrfJsonResponse = JSON.parse(csrfResponse.body);
                            myRequest.url = config.baseUrl + '/PaymentInstruments-SavePayment';
                            myRequest.form = {
                                dwfrm_creditCard_cardType: 'Visa',
                                dwfrm_creditCard_cardOwner: 'Test1',
                                dwfrm_creditCard_cardNumber: '4111111111111111',
                                dwfrm_creditCard_expirationMonth: '10',
                                dwfrm_creditCard_expirationYear: '2030',
                                csrf_token: csrfJsonResponse.csrf.token
                            };
                            return request(myRequest);
                        });
                })
                .then(function () {
                    myRequest.url = config.baseUrl + '/PaymentInstruments-List';
                    myRequest.method = 'GET';
                    delete myRequest.form;
                    return request(myRequest).then(function (response) {
                        var bodyResponse = response.body;
                        var paymentInstrumentRegexp = new RegExp('data-id="(.*)"', 'gm');
                        var regExpResult;
                        regExpResult = paymentInstrumentRegexp.exec(bodyResponse);
                        cardUUID = regExpResult[1];
                        myRequest.url = config.baseUrl + '/PaymentInstruments-DeletePayment?UUID=' +
                            cardUUID;
                    });
                });
        });

        it('should successfully remove credit card method from a wallet', function () {
            return request(myRequest)
                .then(function (deletePaymentResponse) {
                    var response = JSON.parse(deletePaymentResponse.body);
                    assert.equal(deletePaymentResponse.statusCode, 200, 'Expected DeletePayment statusCode to be 200.');
                    assert.equal(response.UUID, cardUUID, 'Expected Payment UUID to be the same as got on preparation.');
                });
        });
    });
});
