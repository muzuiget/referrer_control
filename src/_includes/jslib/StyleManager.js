var StyleManager = (function() {

    var styleService = Cc['@mozilla.org/content/style-sheet-service;1']
                            .getService(Ci.nsIStyleSheetService);
    var ioService = Cc['@mozilla.org/network/io-service;1']
                         .getService(Ci.nsIIOService);

    var STYLE_TYPE = styleService.USER_SHEET;

    var new_nsiURI = function(uri) ioService.newURI(uri, null, null);

    var uris = [];

    var load = function(uri) {
        var nsiURI = new_nsiURI(uri);
        if (styleService.sheetRegistered(nsiURI, STYLE_TYPE)) {
            return;
        }
        styleService.loadAndRegisterSheet(nsiURI, STYLE_TYPE);
        uris.push(uri);
    };

    var unload = function(uri) {
        var nsiURI = new_nsiURI(uri);
        if (!styleService.sheetRegistered(nsiURI, STYLE_TYPE)) {
            return;
        }
        styleService.unregisterSheet(nsiURI, STYLE_TYPE);
        var start = uris.indexOf(uri);
        uris.splice(start, 1);
    };

    var destory = function() {
        for (var uri of uris.slice(0)) {
            unload(uri);
        }
        uris = null;
    };

    var exports = {
        load: load,
        unload: unload,
        destory: destory,
    };
    return exports;
})();

/* exported StyleManager */
