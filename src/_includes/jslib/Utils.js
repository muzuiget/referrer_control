var Utils = (function() {

    var etldService = Cc['@mozilla.org/network/effective-tld-service;1']
                           .getService(Ci.nsIEffectiveTLDService);
    var sbService = Cc['@mozilla.org/intl/stringbundle;1']
                         .getService(Ci.nsIStringBundleService);
    var windowMediator = Cc['@mozilla.org/appshell/window-mediator;1']
                              .getService(Ci.nsIWindowMediator);

    var wildcard2RegExp = function(pattern) {
        var firstChar = pattern.charAt(0);
        var lastChat = pattern.charAt(pattern.length - 1);
        if (firstChar + lastChat === '//') {
            return new RegExp(pattern.slice(1, -1));
        } else {
            pattern = '^' + pattern.replace(/\*/g, '.*') + '$';
            return new RegExp(pattern);
        }
    };
    var fakeTrueTest = {test: function() true};

    var getDomain = function(uri) {
        var domain;
        try {
            domain = etldService.getBaseDomain(uri);
        } catch(error) {
            domain = uri.host; // it's ip, fallback to host
        }
        return domain;
    };
    var isSameDomains = function(uri1, uri2, strict) {
        if (strict) {
            return uri1.host === uri2.host;
        } else {
            return getDomain(uri1) === getDomain(uri2);
        }
    };

    var localization = function(id, name) {
        var uri = 'chrome://' + id + '/locale/' + name + '.properties';
        return sbService.createBundle(uri).GetStringFromName;
    };

    var setAttrs = function(widget, attrs) {
        for (var [key, value] in Iterator(attrs)) {
            widget.setAttribute(key, value);
        }
    };

    var getMostRecentWindow = windowMediator.getMostRecentWindow
                                            .bind(windowMediator);

    var exports = {
        wildcard2RegExp: wildcard2RegExp,
        fakeTrueTest: fakeTrueTest,
        getDomain: getDomain,
        isSameDomains: isSameDomains,
        localization: localization,
        setAttrs: setAttrs,
        getMostRecentWindow: getMostRecentWindow,
    };
    return exports;
})();

/* exported Utils */
