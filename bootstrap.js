/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const log = function() { dump(Array.slice(arguments).join(' ') + '\n'); };
const trace = function(error) { log(error); log(error.stack); };
const dirobj = function(obj) { for (let i in obj) { log(i, ':', obj[i]); } };

const {classes: Cc, interfaces: Ci} = Components;

/* library */

const Utils = (function() {

    const etldService = Cc['@mozilla.org/network/effective-tld-service;1']
                           .getService(Ci.nsIEffectiveTLDService);

    let wildcard2RegExp = function(pattern) {
        let firstChar = pattern.charAt(0);
        let lastChat = pattern.charAt(pattern.length - 1);
        if (firstChar + lastChat === '//') {
            return new RegExp(pattern.substr(1, -1));
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

    let exports = {
        wildcard2RegExp: wildcard2RegExp,
        fakeTrueTest: fakeTrueTest,
        getDomain: getDomain,
        isSameDomains: isSameDomains,
    };
    return exports;
})();

const StyleManager = (function() {

    const styleService = Cc['@mozilla.org/content/style-sheet-service;1']
                            .getService(Ci.nsIStyleSheetService);
    const ioService = Cc['@mozilla.org/network/io-service;1']
                         .getService(Ci.nsIIOService);

    const STYLE_TYPE = styleService.USER_SHEET;

    const new_nsiURI = function(uri) ioService.newURI(uri, null, null);

    let uris = [];

    let load = function(uri) {
        let nsiURI = new_nsiURI(uri);
        if (styleService.sheetRegistered(nsiURI, STYLE_TYPE)) {
            return;
        }
        styleService.loadAndRegisterSheet(nsiURI, STYLE_TYPE);
        uris.push(uri);
    };

    let unload = function(uri) {
        let nsiURI = new_nsiURI(uri);
        if (!styleService.sheetRegistered(nsiURI, STYLE_TYPE)) {
            return;
        }
        styleService.unregisterSheet(nsiURI, STYLE_TYPE);
        let start = uris.indexOf(uri);
        uris.splice(start, 1);
    };

    let destory = function() {
        for (let uri of uris.slice(0)) {
            unload(uri);
        }
        uris = null;
    };

    let exports = {
        load: load,
        unload: unload,
        destory: destory,
    };
    return exports;
})();

const BrowserManager = (function() {

    const windowWatcher = Cc['@mozilla.org/embedcomp/window-watcher;1']
                             .getService(Ci.nsIWindowWatcher);

    const BROWSER_URI = 'chrome://browser/content/browser.xul';

    let listeners = [];

    let onload = function(event) {
        for (let listener of listeners) {
            let window = event.currentTarget;
            window.removeEventListener('load', onload);
            if (window.location.href !== BROWSER_URI) {
                return;
            }
            try {
                listener(window);
            } catch(error) {
                trace(error);
            }
        }
    };

    let observer = {
        observe: function(window, topic, data) {
            if (topic !== 'domwindowopened') {
                return;
            }
            window.addEventListener('load', onload);
        }
    };

    let run = function(func, uri) {
        let enumerator = windowWatcher.getWindowEnumerator();
        while (enumerator.hasMoreElements()) {
            let window = enumerator.getNext();
            if (window.location.href !== BROWSER_URI) {
                continue;
            }

            try {
                func(window);
            } catch(error) {
                trace(error);
            }
        }
    };

    let addListener = function(listener) {
        listeners.push(listener);
    };

    let removeListener = function(listener) {
        let start = listeners.indexOf(listener);
        if (start !== -1) {
            listeners.splice(start, 1);
        }
    };

    let initialize = function() {
        windowWatcher.registerNotification(observer);
    };

    let destory = function() {
        windowWatcher.unregisterNotification(observer);
        listeners = null;
    };

    initialize();

    let exports = {
        run: run,
        addListener: addListener,
        removeListener: removeListener,
        destory: destory,
    };
    return exports;
})();

const ToolbarManager = (function() {

    /**
     * Remember the button position.
     * This function Modity from addon-sdk file lib/sdk/widget.js, and
     * function BrowserWindow.prototype._insertNodeInToolbar
     */
    let layoutWidget = function(document, button, isFirstRun) {

        // Add to the customization palette
        let toolbox = document.getElementById('navigator-toolbox');
        toolbox.palette.appendChild(button);

        // Search for widget toolbar by reading toolbar's currentset attribute
        let container = null;
        let toolbars = document.getElementsByTagName('toolbar');
        let id = button.getAttribute('id');
        for (let i = 0; i < toolbars.length; i += 1) {
            let toolbar = toolbars[i];
            if (toolbar.getAttribute('currentset').indexOf(id) !== -1) {
                container = toolbar;
            }
        }

        // if widget isn't in any toolbar, default add it next to searchbar
        if (!container) {
            if (isFirstRun) {
                container = document.getElementById('nav-bar');
            } else {
                return;
            }
        }

        // Now retrieve a reference to the next toolbar item
        // by reading currentset attribute on the toolbar
        let nextNode = null;
        let currentSet = container.getAttribute('currentset');
        let ids = (currentSet === '__empty') ? [] : currentSet.split(',');
        let idx = ids.indexOf(id);
        if (idx !== -1) {
            for (let i = idx; i < ids.length; i += 1) {
                nextNode = document.getElementById(ids[i]);
                if (nextNode) {
                    break;
                }
            }
        }

        // Finally insert our widget in the right toolbar and in the right position
        container.insertItem(id, nextNode, null, false);

        // Update DOM in order to save position
        // in this toolbar. But only do this the first time we add it to the toolbar
        if (ids.indexOf(id) === -1) {
            container.setAttribute('currentset', container.currentSet);
            document.persist(container.id, 'currentset');
        }
    };

    let addWidget = function(window, widget, isFirstRun) {
        try {
            layoutWidget(window.document, widget, isFirstRun);
        } catch(error) {
            trace(error);
        }
    };

    let removeWidget = function(window, widgetId) {
        try {
            let widget = window.document.getElementById(widgetId);
            widget.parentNode.removeChild(widget);
        } catch(error) {
            trace(error);
        }
    };

    let exports = {
        addWidget: addWidget,
        removeWidget: removeWidget,
    };
    return exports;
})();

let RequestManager = (function() {

    const obsService = Cc['@mozilla.org/observer-service;1']
                          .getService(Ci.nsIObserverService);

    const REQUEST_TOPIC = 'http-on-modify-request';

    let observers = [];

    let addObserver = function(observer) {
        try {
            obsService.addObserver(observer, REQUEST_TOPIC, false);
        } catch(error) {
            trace(error);
        }
        observers.push(observers);
    };

    let removeObserver = function(observer) {
        try {
            obsService.removeObserver(observer, REQUEST_TOPIC, false);
        } catch(error) {
            trace(error);
        }
    };

    let destory = function() {
        for (let observer of observers) {
            removeObserver(observer);
        }
        observers = null;
    };

    let exports = {
        addObserver: addObserver,
        removeObserver: removeObserver,
        destory: destory,
    };
    return exports;
})();

const Pref = function(branchRoot) {

    const supportsStringClass = Cc['@mozilla.org/supports-string;1'];
    const prefService = Cc['@mozilla.org/preferences-service;1']
                           .getService(Ci.nsIPrefService);

    const new_nsiSupportsString = function(data) {
        let string = supportsStringClass.createInstance(Ci.nsISupportsString);
        string.data = data;
        return string;
    };

    let branch = prefService.getBranch(branchRoot);

    let setBool = function(key, value) {
        branch.setBoolPref(key, value);
    };
    let getBool = function(key, defaultValue) {
        let value;
        try {
            value = branch.getBoolPref(key);
        } catch(error) {
            value = defaultValue || null;
        }
        return value;
    };

    let setInt = function(key, value) {
        branch.setIntPref(key, value);
    };
    let getInt = function(key, defaultValue) {
        let value;
        try {
            value = branch.getIntPref(key);
        } catch(error) {
            value = defaultValue || null;
        }
        return value;
    };

    let setString = function(key, value) {
        branch.setComplexValue(key, Ci.nsISupportsString,
                               new_nsiSupportsString(value));
    };
    let getString = function(key, defaultValue) {
        let value;
        try {
            value = branch.getComplexValue(key, Ci.nsISupportsString).data;
        } catch(error) {
            value = defaultValue || null;
        }
        return value;
    };

    let addObserver = function(observer) {
        try {
            branch.addObserver('', observer, false);
        } catch(error) {
            trace(error);
        }
    };
    let removeObserver = function(observer) {
        try {
            branch.removeObserver('', observer, false);
        } catch(error) {
            trace(error);
        }
    };

    let exports = {
        setBool: setBool,
        getBool: getBool,
        setInt: setInt,
        getInt: getInt,
        setString: setString,
        getString: getString,
        addObserver: addObserver,
        removeObserver: removeObserver
    }
    return exports;
};

const Widget = function(window, type, attrs) {

    const NS_XUL = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';

    if (type.trim() === 'script') {
        throw 'Type should not be script';
    }

    let widget = window.document.createElementNS(NS_XUL, type);
    if (attrs) {
        for (let [key, value] in Iterator(attrs)) {
            widget.setAttribute(key, value);
        }
    }
    return widget;
};

/* main */

let Policy = (function() {

    const NAMES = ['skip', 'empty', 'source host', 'source domain',
                   'target host', 'target domain'];

    let toCode = function(name) NAMES.indexOf(name);

    let toName = function(code) NAMES[code];

    let toRules = function(text) {
        if (!text.trim()) {
            return [];
        }

        let json;
        try {
            json = JSON.parse(text);
        } catch(error) {
            trace(error);
            return [];
        }

        let toRegExp = Utils.wildcard2RegExp;
        let fakeRegExp = Utils.fakeTrueTest;
        let isUrlReg = new RegExp('^https\?://');
        let trimSpaces = function(s) s.replace(/ /g, '');

        let rules = [];
        for (let item of json) {
            let rule = {};
            rule.isUrl = isUrlReg.test(item.value);
            if (rule.isUrl) {
                rule.url = item.value;
            } else {
                rule.code = toCode(trimSpaces(item.value));
                if (rule.code === -1) {
                    continue;
                }
            }
            rule.source = item.source && toRegExp(item.source) || fakeRegExp;
            rule.target = item.target && toRegExp(item.target) || fakeRegExp;
            rules.push(rule);
        }
        return rules;
    };

    let exports = {
        NAMES: NAMES,
        toName: toName,
        toCode: toCode,
        toRules: toRules,
    };
    return exports;
})();

let Referrer = (function() {

    let toUrl = function(sourceURI, targetURI, policy) {
        let value;
        switch (policy) {
            case 0: // skip
                return null;
            case 1: // empty
                return '';
            case 2: // source host
                value = sourceURI.host;
                break;
            case 3: // source domain
                value = Utils.getDomain(sourceURI);
                break;
            case 4: // target host
                value = targetURI.host;
                break;
            case 5: // target domain
                value = Utils.getDomain(targetURI);
                break;
            default:
                return null;
        }
        return sourceURI.scheme + '://' + value + '/';
    };

    let debugResult = function(sourceURI, targetURI, result) {
        let lines = ['source: ' + sourceURI.spec,
                     'target: ' + targetURI.spec,
                     'result: ' + result]
        log(lines.join('\n'));
    };

    let getFor = function(sourceURI, targetURI, rules, policy) {
        let result = null;
        for (let rule of rules) {
            let {source, target, isUrl, url, code} = rule;
            if (source.test(sourceURI.spec) && target.test(targetURI.spec)) {
                if (isUrl) {
                    result = url;
                } else {
                    result = toUrl(sourceURI, targetURI, code);
                }
                break;
            }
        }
        if (!result) {
            result = toUrl(sourceURI, targetURI, policy);
        }
        debugResult(sourceURI, targetURI, result);
        return result;
    };

    let exports = {
        getFor: getFor,
    }
    return exports;
})();

let ReferrerControl = (function() {

    const STYLE_URI = 'chrome://referrercontrol/skin/browser.css';
    const PREF_BRANCH = 'extensions.referrercontrol.';

    let config = {
        firstRun: true,
        activated: false,
        ignoreSameDomains: true,
        strictSameDomains: false,
        defaultPolicy: 4, // in pref is name string
        customRules: [], // in pref is json text
    };

    let pref = Pref(PREF_BRANCH);
    let prefObserver = {

        observe: function(subject, topic, data) {
            this.reloadConfig();
            Button.refresh(config.activated, config.defaultPolicy);
        },

        start: function() {
            pref.addObserver(this);
        },
        stop: function() {
            pref.removeObserver(this);
        },

        initBool: function(name) {
            let value = pref.getBool(name);
            if (value === null) {
                pref.setBool(name, config[name]);
            } else {
                config[name] = value;
            }
        },
        initInt: function(name) {
            let value = pref.getInt(name);
            if (value === null) {
                pref.setInt(name, config[name]);
            } else {
                config[name] = value;
            }
        },
        initComplex: function(name, converter, defaultValue) {
            let text = pref.getString(name);
            if (text === null) {
                pref.setString(name, defaultValue);
            } else {
                config[name] = converter(text);
            }
        },

        loadBool: function(name) {
            let value = pref.getBool(name);
            if (value !== null) {
                config[name] = value;
            }
        },
        loadInt: function(name) {
            let value = pref.getInt(name);
            if (value !== null) {
                config[name] = value;
            }
        },
        loadComplex: function(name, converter) {
            let text = pref.getString(name);
            if (text !== null) {
                config[name] = converter(text);
            }
        },

        initConfig: function() {
            let {initBool, initInt, initComplex} = this;
            initBool('firstRun');
            initBool('activated');
            initBool('ignoreSameDomains');
            initBool('strictSameDomains');
            initInt('defaultPolicy');
            initComplex('customRules', Policy.toRules, '');
        },
        reloadConfig: function() {
            let {loadBool, loadInt, loadComplex} = this;
            loadBool('firstRun');
            loadBool('activated');
            loadBool('ignoreSameDomains');
            loadBool('strictSameDomains');
            loadInt('defaultPolicy');
            loadComplex('customRules', Policy.toRules);
        },
        saveConfig: function() {
            this.stop(); // avoid recursion

            pref.setBool('firstRun', false);
            pref.setBool('activated', config.activated);
            pref.setInt('defaultPolicy', config.defaultPolicy);

            this.start();
        }
    };

    let reqObserver = {

        observing: false,

        observe: function(subject, topic, data) {
            try {
                let channel = subject.QueryInterface(Ci.nsIHttpChannel);
                this.override(channel);
            } catch(error) {
                trace(error);
            }
        },

        start: function() {
            if (!this.observing) {
                RequestManager.addObserver(this);
                this.observing = true;
            }
        },
        stop: function() {
            if (this.observing) {
                RequestManager.removeObserver(this);
                this.observing = false;
            }
        },
        refresh: function() {
            if (config.activated) {
                this.start();
            } else {
                this.stop();
            }
        },

        override: function(channel) {
            if (!channel.referrer) {
                return;
            }

            let {ignoreSameDomains, strictSameDomains,
                defaultPolicy, customRules} = config;
            let {referrer: sourceURI, URI: targetURI} = channel;

            // ignore same domains
            if (ignoreSameDomains &&
                    Utils.isSameDomains(sourceURI, targetURI,
                                        strictSameDomains)) {
                return;
            }

            // now find override referrer string
            let referrer = Referrer.getFor(sourceURI, targetURI,
                                        customRules, defaultPolicy);
            if (referrer === null) {
                return;
            }

            channel.setRequestHeader('Referer', referrer, false);
        }
    };

    let toolbarButtons = {

        refresh: function() {
            let {activated, defaultPolicy} = config;
            BrowserManager.run(function(window) {
                let document = window.document;
                let button = document.getElementById('referrercontrol-button');
                if (activated) {
                    button.removeAttribute('disabled');
                } else {
                    button.setAttribute('disabled', 'yes');
                }
                let menuitems = button.getElementsByTagName('menuitem');
                for (let menuitem of menuitems) {
                    let value = parseInt(menuitem.getAttribute('value'));
                    menuitem.setAttribute('checked', value === defaultPolicy);
                }
            });
        },

        toggle: function(activated) {
            if (activated === undefined) {
                activated = !config.activated;
            }
            config.activated = activated;
            reqObserver.refresh();
            this.refresh();
        },

        createButtonCommand: function() {
            let that = this; // damn it
            return function(event) {
                // click menuitem auto activate button
                if (event.target === this) {
                    that.toggle();
                } else {
                    that.toggle(true);
                }
            }
        },

        onMenuitemCommand: function(event) {
            config.defaultPolicy = parseInt(event.target.getAttribute('value'));
        },

        createInstance: function(window) {

            let createButton = function() {
                let attrs = {
                    id: 'referrercontrol-button',
                    'class': 'toolbarbutton-1 chromeclass-toolbar-additional',
                    type: 'menu-button',
                    removable: true,
                    label: 'Referrer Control',
                    tooltiptext: 'Referrer Control'
                };
                if (!config.activated) {
                    attrs.disabled = 'yes';
                }
                return Widget(window, 'toolbarbutton', attrs);
            };

            let createMenupopup = function() {
                return Widget(window, 'menupopup');
            };

            let createMenuitems = function() {
                let {defaultPolicy} = config;
                let menuitems = [];
                for (let name of Policy.NAMES) {
                    let code = Policy.toCode(name);
                    let attrs = {
                        label: name,
                        value: code,
                        name: 'referrercontrol-policy',
                        type: 'radio',
                        checked: code === defaultPolicy,
                    };
                    let menuitem = Widget(window, 'menuitem', attrs);
                    menuitems.push(menuitem);
                }
                return menuitems;
            };

            let button = createButton();
            button.addEventListener('command', this.createButtonCommand());

            let menupopup = createMenupopup();
            for (let menuitem of createMenuitems()) {
                menuitem.addEventListener('command', this.onMenuitemCommand);
                menupopup.appendChild(menuitem);
            }
            button.appendChild(menupopup);
            return button;
        }
    };

    let insertToolbarButton = function(window) {
        let button = toolbarButtons.createInstance(window);
        try {
            ToolbarManager.addWidget(window, button, config.firstRun);
        } catch(error) {
            trace(error);
        }
    };
    let removeToolbarButton = function(window) {
        try {
            ToolbarManager.removeWidget(window, 'referrercontrol-button');
        } catch(error) {
            trace(error);
        }
    };

    let initialize = function() {
        prefObserver.initConfig();
        prefObserver.start();
        reqObserver.start();

        BrowserManager.run(insertToolbarButton);
        BrowserManager.addListener(insertToolbarButton);
        StyleManager.load(STYLE_URI);
    };
    let destory = function() {
        prefObserver.saveConfig();
        prefObserver.stop();
        reqObserver.stop();

        BrowserManager.run(removeToolbarButton);
        BrowserManager.destory();
        StyleManager.destory();
    };

    let exports = {
        initialize: initialize,
        destory: destory,
    }
    return exports;
})();

/* bootstrap */

let install = function(data, reason) {};
let uninstall = function(data, reason) {};

let startup = function(data, reason) {
    ReferrerControl.initialize();
};

let shutdown = function(data, reason) {
    ReferrerControl.destory();
};
