var chai = require('chai');
var config = require('../it.config');
var request = require('request-promise').defaults({ simple: false });
var chaiSubset = require('chai-subset');
var assert = chai.assert;
var baseUrl = config.baseUrl;
chai.use(chaiSubset);
var cookieJar = request.jar();

describe('Nuvei-OrderOpen', function () {
    describe('When integration opening order and gets session', function () {
        this.timeout(20000);

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
                    var cookie = request.cookie(cookieString);
                    cookieJar.setCookie(cookie, myRequest.url);
                });
        });

        it('should successfully Open Order on Nuvei side', function () {
            // step2 : Openinig order on Nuvei side
            myRequest.url = config.baseUrl + '/Nuvei-OrderOpen';
            myRequest.method = 'GET';
            return request(myRequest)
                .then(function (response) {
                    var bodyAsJson = JSON.parse(response.body);

                    assert.equal(response.statusCode, 200, 'Expected Nuvei-OrderOpen statusCode to be 200.');
                    assert.isFalse(bodyAsJson.error);
                    assert.isNotNull(bodyAsJson.sessionToken);
                    assert.isNotNull(bodyAsJson.clientUniqueId);
                });
        });
    });
});
