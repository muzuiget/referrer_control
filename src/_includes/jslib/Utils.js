var Utils = (function() {

    const etldService = Cc['@mozilla.org/network/effective-tld-service;1']
                           .getService(Ci.nsIEffectiveTLDService);
    const sbService = Cc['@mozilla.org/intl/stringbundle;1']
                         .getService(Ci.nsIStringBundleService);
    const windowMediator = Cc['@mozilla.org/appshell/window-mediator;1']
                              .getService(Ci.nsIWindowMediator);

    let wildcard2RegExp = function(pattern) {
        let firstChar = pattern.charAt(0);
        let lastChat = pattern.charAt(pattern.length - 1);
        if (firstChar + lastChat === '//') {
            return new RegExp(pattern.slice(1, -1));
        } else {
            pattern = '^' + pattern.replace(/\*/g, '.*') + '$';
            return new RegExp(pattern);
        }
    };
    let fakeTrueTest = {test: function() true};

    let getDomain = function(uri) {
        let domain;
        try {
            domain = etldService.getBaseDomain(uri);
        } catch(error) {
            domain = uri.host; // it's ip, fallback to host
        }
        return domain;
    };
    let isSameDomains = function(uri1, uri2, strict) {
        if (strict) {
            return uri1.host === uri2.host;
        } else {
            return getDomain(uri1) === getDomain(uri2);
        }
    };

    let localization = function(id, name) {
        let uri = 'chrome://' + id + '/locale/' + name + '.properties';
        return sbService.createBundle(uri).GetStringFromName;
    };

    let setAttrs = function(widget, attrs) {
        for (let [key, value] in Iterator(attrs)) {
            widget.setAttribute(key, value);
        }
    };

    let getMostRecentWindow = windowMediator.getMostRecentWindow
                                            .bind(windowMediator);

    let exports = {
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
