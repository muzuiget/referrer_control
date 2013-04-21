"use strict";

let EXPORTED_SYMBOLS = ['StyleManager'];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import('resource://gre/modules/Services.jsm');

const ioService = Services.io;
const styleService = Cc['@mozilla.org/content/style-sheet-service;1']
                       .getService(Ci.nsIStyleSheetService);

const styleType = styleService.USER_SHEET;
const nsi = {
    URI: function(uri) {
        return ioService.newURI(uri, null, null);
    }
};

let StyleManager = {

    uris: [],

    load: function(uri) {
        let nsiURI = nsi.URI(uri);
        if (styleService.sheetRegistered(nsiURI, styleType)) {
            return;
        }
        styleService.loadAndRegisterSheet(nsiURI, styleType);
        this.uris.push(uri);
    },

    unload: function(uri) {
        let nsiURI = nsi.URI(uri);
        if (!styleService.sheetRegistered(nsiURI, styleType)) {
            return;
        }
        styleService.unregisterSheet(nsiURI, styleType);
        let start = this.uris.indexOf(uri);
        this.uris.splice(start, 1);
    },

    unloadAll: function() {
        for (let uri of this.uris.slice(0)) {
            this.unload(uri);
        }
    }

};
