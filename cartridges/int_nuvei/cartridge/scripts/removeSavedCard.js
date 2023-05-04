'use strict';

/**
 * Deletes saved cards from Nuvei's customer account
 *
 * @input CurrentCustomer : dw.customer.Customer
 * @input PaymentToDelete : dw.order.PaymentInstrument
 */

/* API Includes */
const Logger = require('dw/system/Logger');

/**
 * Deletes saved cards from Nuvei's customer account
 * @param {*} args - input parameters
 * @returns {Object} Error status
 */
function removeSavedCard(args) {
    const NuveiLogger = Logger.getLogger('Nuvei', 'nuvei');

    const nuveiServices = require('*/cartridge/scripts/nuveiServices');
    var result = {
        error: false
    };

    try {
        var customer = args.CurrentCustomer;

        if (!(customer && customer.getProfile() && customer.getProfile().getWallet())) {
            NuveiLogger.error('Error while updating saved cards, could not get customer data');

            result.error = true;
        } else {
            var payment = args.PaymentToDelete;

            var params = {
                customerNo: customer.getProfile().getCustomerNo(),
                creditCardToken: payment.getCreditCardToken(),
            };
            var deletionResult = nuveiServices.deleteUserUPO(params);

            if (deletionResult.status === 'ERROR') {
                result.error = true;
            }
        }
    } catch (ex) {
        NuveiLogger
            .error(''.concat(ex.toString(), ' in ').concat(ex.fileName, ':').concat(ex.lineNumber));

        result.error = true;
    }
    return result;
}

module.exports = {
    removeSavedCard: removeSavedCard
};
