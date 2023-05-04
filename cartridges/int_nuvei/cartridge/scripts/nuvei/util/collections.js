'use strict';

const ArrayList = require('dw/util/ArrayList');

/**
 * Adds value custom attribute with the SetOfStrings type
 *
 * @param {dw.util.Collection} attribute - custom attribute
 * @returns {dw.util.ArrayList} - updated custom attribute
 */
const addToSetOfStrings = function (attribute) {
    let list;

    if (!attribute) {
        list = new ArrayList();
    } else {
        list = new ArrayList(attribute);
    }

    for (let i = 1; i < arguments.length; i++) {
        list.push(arguments[i]);
    }

    return list;
};

/**
 * forEach method for dw.util.Collection subclass instances
 * @param {dw.util.Collection} collection - Collection subclass instance to map over
 * @param {Function} callback - Callback function for each item
 * @param {Object} [scope] - Optional execution scope to pass to callback
 * @returns {void}
 */
function forEach(collection, callback, scope) {
    var iterator = collection.iterator();
    var index = 0;
    var item = null;
    while (iterator.hasNext()) {
        item = iterator.next();
        if (scope) {
            callback.call(scope, item, index, collection);
        } else {
            callback(item, index, collection);
        }
        index++;
    }
}

module.exports = {
    addToSetOfStrings: addToSetOfStrings,
    forEach: forEach
};
