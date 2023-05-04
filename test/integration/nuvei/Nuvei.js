var chai = require('chai');
var config = require('../it.config');
var request = require('request-promise').defaults({ simple: false });
var chaiSubset = require('chai-subset');
var assert = chai.assert;
var baseUrl = config.baseUrl;
chai.use(chaiSubset);
var cookieJar = request.jar();

var testDMNData = { 'bin': '400002', 'Token': 'ZQBVAEcAWABOAGoAUgBOAGQASgBZAFkAIwA+AG0AKQB8AFIAUgBOAHkAXQBYAFgAYgBXADsAMQBiAHsAUQB4ADEAdgBPACcANAB5AFsAcwBYAE0AMwA=', 'type': 'DEPOSIT', 'TransactionID': '1110000000013317725', 'expYear': '30', 'acquirerId': '19', 'Status': 'APPROVED', 'errScCode': '0', 'productId': 'NA', 'tokenId': '1657972480', 'item_shipping_1': '0.00', 'responseTimeStamp': '2021-04-21.17:18:09', 'user_token_id': '609659142', 'ErrCode': '0', 'expMonth': '03', 'cardIssuerCountry': 'GB', 'userPaymentOptionId': '67567198', 'advanceResponseChecksum': '8bc4aba30633fdb96c3ded370c143e3bd2843c4abface6622cccab97f0914890', 'cardNumber': '4****5864', 'item_amount_1': '30.31', 'merchant_unique_id': 'Z1800000102', 'PPP_TransactionID': '283585068', 'total_shipping': '0.00', 'currency': 'GBP', 'email': 'testuser1@demandware.com', 'ExErrCode': '0', 'errApmCode': '0', 'item_handling_1': '0.00', 'transactionType': 'Sale', 'ppp_status': 'OK', 'total_handling': '0.00', 'country': 'United Kingdom', 'uniqueCC': 'jrXmCXgF1L01ybR6aNRlU47jk34=', 'item_name_1': 'NA', 'client_ip': '127.0.0.1', 'payment_method': 'cc_card', 'merchant_site_id': '212638', 'acquirerBank': 'Safecharge bank', 'total_tax': '0.00', 'ReasonCode': '0', 'totalAmount': '30.31', 'clientUniqueId': 'Z1800000102', 'item_quantity_1': '1', 'total_discount': '0.00', 'merchant_id': '317716059143945003', 'nameOnCard': 'OK', 'responsechecksum': '2cbe0e6e74f8c58fba9336f8d683354cf6b8574e215881e1eb2bf838f32413fe', 'cardCompany': 'Visa', 'dynamicDescriptor': 'test', 'AuthCode': '111881', 'upoRegistrationDate': '20210421', 'cardType': 'Credit', 'message': 'APPROVED', 'item_discount_1': '0.00' };

describe('Nuvei-DMN', function () {
    describe('When Direct Merchant Notification coming', function () {
        this.timeout(20000);

        var myRequest = {
            url: baseUrl + '/Nuvei-DMN',
            method: 'POST',
            rejectUnauthorized: false,
            resolveWithFullResponse: true,
            jar: cookieJar,
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            },
            form: testDMNData
        };

        it('should successfully store DMN to Custom Object', function () {
            return request(myRequest)
                .then(function (response) {
                    assert.equal(response.statusCode, 200, 'Expected DMN statusCode to be 200.');
                });
        });

        it('should decline DMN if checksum not valid', function () {
            testDMNData.advanceResponseChecksum = 'WRONG_CHECKSUM';
            return request(myRequest)
                .then(function (response) {
                    assert.equal(response.statusCode, 500, 'Expected DMN statusCode to be 500.');
                });
        });
    });
});
