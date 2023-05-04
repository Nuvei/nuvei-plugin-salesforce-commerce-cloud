'use strict';

const URLUtils = require('dw/web/URLUtils');

const nuveiServices = require('*/cartridge/scripts/nuveiServices');
const preferences = require('*/cartridge/scripts/nuveiPreferences');
const nuveiHelper = require('*/cartridge/scripts/util/nuveiHelper');
const server = require('server');

server.extend(module.superModule);


server.append('Begin', function (req, res, next) {
    const viewData = res.getViewData();

    if (req.currentCustomer.raw.isAuthenticated()) {
        require('*/cartridge/scripts/updateSavedCards').updateSavedCards({
            CurrentCustomer: req.currentCustomer.raw
        });
    }

    viewData.nuveiEnvironment = preferences.getEnvironment();
    viewData.nuveiMerchantId = preferences.getMerchantId();
    viewData.nuveiMerchantSiteId = preferences.getMerchantSiteId();
    viewData.nuveiSessionToken = nuveiServices.getSessionToken();
    viewData.nuveiOrderOpenURL = URLUtils.https('Nuvei-OrderOpen');

    viewData.errorMessage = nuveiHelper.getErrorMessage();
    nuveiHelper.clearErrorMessage();

    res.setViewData(viewData);
    next();
});

module.exports = server.exports();
