"use strict";

let EXPORTED_SYMBOLS = ['Utils'];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import('resource://gre/modules/Services.jsm');

const tldService = Services.eTLD;

let Utils = {
    wildcard2RegExp: function(pattern) {
        let firstChar = pattern.charAt(0);
        let lastChat = pattern.charAt(pattern.length - 1);
        if (firstChar + lastChat === '//') {
            return new RegExp(pattern.substr(1, -1));
        } else {
            pattern = '^' + pattern.replace(/\*/g, '.*') + '$';
            return new RegExp(pattern);
        }
    },
    fakeTrueTest: {test: function() true},

    getDomain: function(uri) {
        let domain;
        try {
            domain = tldService.getBaseDomain(uri);
        } catch(error) {
            domain = uri.host; // it's ip, fallback to host
        }
        return domain;
    },
    isSameDomains: function(uri1, uri2, strict) {
        if (strict) {
            return uri1.host === uri2.host;
        } else {
            return this.getDomain(uri1) === this.getDomain(uri2);
        }
    },
};
