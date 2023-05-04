'use strict';

const Logger = require('dw/system/Logger');

const nuveiCustomObjectsHelper = require('~/cartridge/scripts/util/nuveiCustomObjectsHelper');

const NuveiLogger = Logger.getLogger('Nuvei', 'nuvei');

const execute = function () {
    const customObjs = nuveiCustomObjectsHelper.getAll();
    const toRemove = [];

    while (customObjs.hasNext()) {
        let customObj = customObjs.next();
        try {
            let placeResult = nuveiCustomObjectsHelper.handle(customObj);

            if (placeResult.remove) {
                toRemove.push(customObj);
            }
        } catch (e) {
            NuveiLogger.error('Place order failed. Error: ' + e.toString());
        }
    }

    toRemove.forEach(nuveiCustomObjectsHelper.remove);

    return PIPELET_NEXT; // eslint-disable-line no-undef
};

module.exports = {
    execute: execute,
};
