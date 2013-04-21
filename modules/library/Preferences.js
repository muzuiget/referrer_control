"use strict";

let EXPORTED_SYMBOLS = ['Preferences'];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

const prefService = Cc['@mozilla.org/preferences-service;1']
                      .getService(Ci.nsIPrefService);

const log = function() { dump(Array.slice(arguments).join(' ') + '\n'); }
const nsi = {
    SupportsString: function(data) {
        let string = Cc['@mozilla.org/supports-string;1']
                       .createInstance(Ci.nsISupportsString);
        string.data = data;
        return string;
    }
};

let Preferences = function(branch) {
    let pref = prefService.getBranch(branch);

    let setBool = function(key, value) {
        pref.setBoolPref(key, value);
    };
    let getBool = function(key, defaultValue) {
        let value = defaultValue;
        try {
            value = pref.getBoolPref(key);
        } catch(error) {
            if (defaultValue !== undefined) {
                setBool(key, defaultValue);
            }
        }
        return value;
    };

    let setString = function(key, value) {
        pref.setComplexValue(key, Ci.nsISupportsString,
                             nsi.SupportsString(value));
    };
    let getString = function(key, defaultValue) {
        let value = defaultValue;
        try {
            value = pref.getComplexValue(key, Ci.nsISupportsString).data;
        } catch(error) {
            if (defaultValue !== undefined) {
                setString(key, defaultValue);
            }
        }
        return value;
    };

    let addObserver = function(observer) {
        try {
            pref.addObserver('', observer, false);
        } catch(error) {
            log(error);
        }
    };
    let removeObserver = function(observer) {
        try {
            pref.removeObserver('', observer, false);
        } catch(error) {
            log(error);
        }
    };

    let exports = {
        setBool: setBool,
        getBool: getBool,
        setString: setString,
        getString: getString,
        addObserver: addObserver,
        removeObserver: removeObserver
    }
    return exports;
};
