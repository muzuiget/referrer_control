"use strict";

let EXPORTED_SYMBOLS = ['Widget'];

const NS_XUL = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
const log = function() { dump(Array.slice(arguments).join(' ') + '\n'); }

let Widget = function(window, type, attrs) {
    if (type.trim() === 'script') {
        throw 'Type should not be script';
    }
    let widget = window.document.createElementNS(NS_XUL, type);
    if (!attrs) {
        return widget;
    }
    for (let [key, value] in Iterator(attrs)) {
        widget.setAttribute(key, value);
    }
    return widget;
};
