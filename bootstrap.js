/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
const log = function() { dump(Array.slice(arguments).join(' ') + '\n'); }

/* library */

const Utils = (function() {

    const ioService = Cc['@mozilla.org/network/io-service;1']
                        .getService(Ci.nsIIOService);
    const tldService = Cc['@mozilla.org/network/effective-tld-service;1']
                         .getService(Ci.nsIEffectiveTLDService);

    let exports = {

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

        loadResource: function(name, folder) {
            let resource = ioService.getProtocolHandler('resource')
                                    .QueryInterface(Ci.nsIResProtocolHandler);
            let path = __SCRIPT_URI_SPEC__ + '/../' + folder + '/';
            let resourceURI = ioService.newURI(path, null, null);
            resource.setSubstitution(name, resourceURI);
            resource.setSubstitution('moduleloader', resourceURI);
        }

    };

    return exports;
})();

const StyleManager = (function() {

    const ioService = Cc['@mozilla.org/network/io-service;1']
                        .getService(Ci.nsIIOService);
    const styleService = Cc['@mozilla.org/content/style-sheet-service;1']
                           .getService(Ci.nsIStyleSheetService);

    const styleType = styleService.USER_SHEET;
    const nsi = {
        URI: function(uri) {
            return ioService.newURI(uri, null, null);
        }
    };

    let exports = {

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

    return exports;
})();

const ToolbarManager = (function() {

    const BROWSER_URI = 'chrome://browser/content/browser.xul';

    let exports = {

        /**
        * Remember the button position.
        * This function Modity from addon-sdk file lib/sdk/widget.js, and
        * function BrowserWindow.prototype._insertNodeInToolbar
        */
        layoutWidget: function(document, button, isFirstRun) {

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
        },

        addWidget: function(window, widget, isFirstRun) {
            if (window.location.href !== BROWSER_URI) {
                return;
            }

            let document = window.document;
            try {
                this.layoutWidget(document, widget, isFirstRun);
            } catch(error) {
                log(error);
            }
        },

        removeWidget: function(window, widgetId) {
            if (window.location.href !== BROWSER_URI) {
                return;
            }

            let document = window.document;
            try {
                let widget = document.getElementById(widgetId);
                widget.parentNode.removeChild(widget);
            } catch(error) {
                log(error);
            }
        }

    };

    return exports;
})();

const ChannelManager = (function() {

    const obsService = Cc['@mozilla.org/observer-service;1']
                         .getService(Ci.nsIObserverService);

    let exports =  {

        addObserver: function(listener, topic) {
            try {
                obsService.addObserver(listener, topic, false);
            } catch(error) {
                log(error);
            }
        },

        removeObserver: function(listener, topic) {
            try {
                obsService.removeObserver(listener, topic, false);
            } catch(error) {
                log(error);
            }
        }
    };

    return exports;
})();

const WindowManager = (function() {

    const windowWatcher = Cc['@mozilla.org/embedcomp/window-watcher;1']
                            .getService(Ci.nsIWindowWatcher);
    const obsService = Cc['@mozilla.org/observer-service;1']
                         .getService(Ci.nsIObserverService);

    const BROWSER_URI = 'chrome://browser/content/browser.xul';
    const OBSERVER_NAME = 'chrome-document-global-created';

    let exports = {

        listeners: [],
        observe: function(window, topic, data) {
            if (topic !== OBSERVER_NAME) {
                return;
            }
            let $this = this;
            window.addEventListener('load', function(event) {
                for (let listener of $this.listeners) {
                    listener(window);
                }
            });
        },

        initialized: false,
        initialize: function() {
            if (this.initialized) {
                return;
            }
            this.listeners = [];
            obsService.addObserver(this, OBSERVER_NAME, false);
            this.initialized = true;
        },
        destory: function() {
            if (!this.initialized) {
                return;
            }
            this.listeners = [];
            obsService.removeObserver(this, OBSERVER_NAME, false);
            this.initialized = false;
        },

        apply: function(func) {
            for (let window of this.getAllWindows()) {
                try {
                    func(window);
                } catch(error) {
                    log(error);
                }
            }
        },
        addListener: function(listener) {
            this.listeners.push(listener);
        },
        removeListener: function(listener) {
            let start = this.listeners.indexOf(listener);
            if (start !== -1) {
                this.listeners.splice(start, 1);
            }
        },

        getAllWindows: function() {
            let windows = [];
            let topWindows = this.getTopWindows();
            windows = windows.concat(topWindows);

            for (let topWindow of topWindows) {
                if (!this.isBrowser(topWindow)) {
                    continue;
                }
                let tabWindows = this.getTabWindows(topWindow);
                windows = windows.concat(tabWindows);
            }
            return windows;
        },
        getTopWindows: function() {
            let windows = [];
            let enumerator = windowWatcher.getWindowEnumerator();
            while (enumerator.hasMoreElements()) {
                windows.push(enumerator.getNext());
            }
            return windows;
        },
        getTabWindows: function(topWindow) {
            let windows = [];
            for (let browser of topWindow.gBrowser.browsers) {
                let window = browser.contentWindow;
                if (!this.isChrome(window)) {
                    continue;
                }
                windows.push(window);
            }
            return windows;
        },

        getUid: function(window) {
            return window.QueryInterface(Ci.nsIInterfaceRequestor)
                         .getInterface(Ci.nsIDOMWindowUtils)
                         .outerWindowID;
        },

        isBrowser: function(window) {
            return window.location.href === BROWSER_URI;
        },
        isChrome: function(window) {
            return window.location.href.startsWith('chrome://');
        }
    };

    return exports;
})();

const Preferences = (function() {

    const prefService = Cc['@mozilla.org/preferences-service;1']
                          .getService(Ci.nsIPrefService);

    const nsi = {
        SupportsString: function(data) {
            let string = Cc['@mozilla.org/supports-string;1']
                        .createInstance(Ci.nsISupportsString);
            string.data = data;
            return string;
        }
    };

    let exports = function(branch) {
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

        let wrapper = {
            setBool: setBool,
            getBool: getBool,
            setString: setString,
            getString: getString,
            addObserver: addObserver,
            removeObserver: removeObserver
        }
        return wrapper;
    };

    return exports;
})();

const Widget = (function() {

    const NS_XUL = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';

    let exports = function(window, type, attrs) {
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

    return exports;
})();

/* main */

const STYLE_URI = 'chrome://referrercontrol/skin/browser.css';
const PREFERENCE_BRANCH = 'extensions.referrercontrol.';
const POLICY_NAMES = ['skip', 'empty', 'sourcehost',
                      'sourcedomain', 'targethost', 'targetdomain'];

let ReferrerControl = {

    config: {
        activated: false,
        firstRun: true,
        ignoreSameDomains: true,
        strictSameDomains: false,
        defaultPolicy: 'targethost',
        defaultPolicyCode: 4,
        customPolicies: '',
        customPoliciesRules: []
    },

    preferences: null,

    observe: function(subject, topic, data) {
        if (topic === 'http-on-modify-request') {
            let channel = subject.QueryInterface(Ci.nsIHttpChannel);
            try {
                this.handlerReferrer(channel);
            } catch(error) {
                log(error);
            }
            return;
        }

        if (topic === 'nsPref:changed') {
            this.loadPreferences();
            this.refreshToolbarButton();
            this.refreshRequestListener();
            return;
        }

    },
    loadPreferences: function() {
        let pref = this.preferences;
        let config = {};
        pref.removeObserver(this);

        config.activated = pref.getBool('activated', false);
        config.firstRun = pref.getBool('firstRun', true);
        config.ignoreSameDomains = pref.getBool('ignoreSameDomains', true);
        config.strictSameDomains = pref.getBool('strictSameDomains', false);

        config.defaultPolicy = pref.getString('defaultPolicy', 'targethost');
        config.defaultPolicyCode = this.nameToCode(config.defaultPolicy);

        config.customPolicies = pref.getString('customPolicies', '');
        config.customPoliciesRules = this.compileRules(config.customPolicies);

        pref.addObserver(this);
        this.config = config;
    },

    initialize: function() {
        this.preferences = Preferences(PREFERENCE_BRANCH);
        this.loadPreferences();
        this.refreshRequestListener();

        StyleManager.load(STYLE_URI);
        WindowManager.initialize();
        WindowManager.apply(this.onWindowLoad);
        WindowManager.addListener(this.onWindowLoad);
    },
    destory: function() {
        this.preferences.removeObserver(this);
        if (this.requestListenerAdded) {
            ChannelManager.removeObserver(this, 'http-on-modify-request');
        }
        this.requestListenerAdded = false;
        this.saveConfig();

        StyleManager.unloadAll();
        WindowManager.apply(this.onWindowUnload);
        WindowManager.destory();
    },

    compileRules: function(text) {
        // TODO: need more detail error check
        if (!text.trim()) {
            return [];
        }

        let json;
        try {
            json = JSON.parse(text);
        } catch(error) {
            log(error);
            return [];
        }

        let toRegExp = Utils.wildcard2RegExp;
        let fakeRegExp = Utils.fakeTrueTest;
        let isUrlReg = new RegExp('^https\?://');

        let rules = [];
        for (let item of json) {
            let rule = {};
            rule.isUrl = isUrlReg.test(item.value);
            if (rule.isUrl) {
                rule.url = item.value;
            } else {
                rule.code = this.nameToCode(item.value);
                if (rule.code === -1) {
                    continue;
                }
            }
            rule.source = item.source && toRegExp(item.source) || fakeRegExp;
            rule.target = item.target && toRegExp(item.target) || fakeRegExp;
            rules.push(rule);
        }
        return rules;
    },

    createToolbarButton: function(window) {
        let $this = this;

        let onButtonCommand = function(event) {
            if (event.target === button) {
                $this.toggle();
            } else {
                $this.toggle(true);
            }
        };

        let onMenuitemCommand = function(event) {
            let name = event.target.value;
            let config = $this.config;
            config.defaultPolicy = name;
            config.defaultPolicyCode = $this.nameToCode(name);
        };

        let createButton = function() {
            let attrs = {
                id: 'referrercontrol-button',
                'class': 'toolbarbutton-1 chromeclass-toolbar-additional',
                type: 'menu-button',
                removable: true,
                label: 'Referrer Control',
                tooltiptext: 'Referrer Control'
            };
            if (!$this.config.activated) {
                attrs.disabled = 'yes';
            }
            return Widget(window, 'toolbarbutton', attrs);
        };

        let createMenupopup = function() {
            return Widget(window, 'menupopup');
        };

        let createMenuitems = function() {
            let {defaultPolicy} = $this.config;

            let menuitems = [];
            for (let name of POLICY_NAMES) {
                let attrs = {
                    label: name,
                    value: name,
                    name: 'referrercontrol-policy',
                    type: 'radio',
                    checked: name === defaultPolicy,
                };
                let menuitem = Widget(window, 'menuitem', attrs);
                menuitems.push(menuitem);
            }
            return menuitems;
        };

        let button = createButton();
        button.addEventListener('command', onButtonCommand);

        let menupopup = createMenupopup();
        for (let menuitem of createMenuitems()) {
            menuitem.addEventListener('command', onMenuitemCommand);
            menupopup.appendChild(menuitem);
        }
        button.appendChild(menupopup);
        return button;
    },
    refreshToolbarButton: function() {
        let {activated, defaultPolicy} = this.config;
        WindowManager.apply(function(window) {
            if (!WindowManager.isBrowser(window)) {
                return;
            }
            let document = window.document;
            let button = document.getElementById('referrercontrol-button');
            if (!button) {
                return;
            }

            if (activated) {
                button.removeAttribute('disabled');
            } else {
                button.setAttribute('disabled', 'yes');
            }
            let menuitems = button.getElementsByTagName('menuitem');
            for (let menuitem of menuitems) {
                let value = menuitem.getAttribute('value');
                menuitem.setAttribute('checked', value === defaultPolicy);
            }
        });
    },

    toggle: function(activated) {
        if (activated === undefined) {
            activated = !this.config.activated;
        }
        this.config.activated = activated;
        this.saveConfig();
        this.refreshToolbarButton();
        this.refreshRequestListener();
    },

    saveConfig: function() {
        let pref = this.preferences;
        let {activated, defaultPolicy} = this.config;

        pref.removeObserver(this);
        pref.setBool('activated', activated);
        pref.setBool('firstRun', false);
        pref.setString('defaultPolicy', defaultPolicy);
        pref.addObserver(this);
    },

    nameToCode: function(name) {
        return POLICY_NAMES.indexOf(name);
    },
    codeToName: function(code) {
        return POLICY_NAMES[code];
    },

    requestListenerAdded: false,
    refreshRequestListener: function() {
        if (this.config.activated) {
            if (!this.requestListenerAdded) {
                ChannelManager.addObserver(this, 'http-on-modify-request');
                this.requestListenerAdded = true;
            }
        } else {
            if (this.requestListenerAdded) {
                ChannelManager.removeObserver(this, 'http-on-modify-request');
                this.requestListenerAdded = false;
            }
        }
    },

    debugResult: function(channel, referrer) {
        let lines = [channel.originalURI.spec,
                    'from: ' + channel.referrer.spec,
                    '  to: ' + referrer]
        log(lines.join('\n  '));
    },
    handlerReferrer: function(channel) {
        // check if have header
        if (!channel.referrer) {
            return;
        }

        let {ignoreSameDomains, strictSameDomains} = this.config;

        // ignore same domains
        if (ignoreSameDomains &&
                Utils.isSameDomains(channel.URI, channel.referrer,
                                    strictSameDomains)) {
            return;
        }

        // now select override policy
        let referrer = this.makeReferrer(channel);
        //this.debugResult(channel, referrer);
        if (referrer === null) {
            return;
        }

        channel.setRequestHeader('Referer', referrer, false);
    },

    makeReferrer: function(channel) {
        let {defaultPolicyCode, customPoliciesRules} = this.config;
        let {URI, referrer} = channel;
        for (let rule of customPoliciesRules) {
            let {source, target, isUrl, url, code} = rule;
            if (!source.test(referrer.spec) || !target.test(URI.spec)) {
                continue;
            }
            if (isUrl) {
                return url;
            } else {
                return this.codeToUrl(channel, code);
            }
        }
        return this.codeToUrl(channel, defaultPolicyCode);
    },
    codeToUrl: function(channel, code) {
        let value;
        switch (code) {
            case 0: // skip
                return null;
            case 1: // empty
                return '';
            case 2: // sourcehost
                value = channel.referrer.host;
                break;
            case 3: // sourcedomain
                value = Utils.getDomain(channel.referrer);
                break;
            case 4: // targethost
                value = channel.URI.host;
                break;
            case 5: // targetdomain
                value = Utils.getDomain(channel.URI);
                break;
            default:
                return null;
        }
        return channel.referrer.scheme + '://' + value + '/';
    },

    // WindowManager listener callbacks
    get onWindowLoad() {
        let $this = this;
        return function(window) {
            if (!WindowManager.isBrowser(window)) {
                return;
            }
            try {
                let button = $this.createToolbarButton(window);
                let isFirstRun = $this.config.firstRun;
                ToolbarManager.addWidget(window, button, isFirstRun);
            } catch(error) {
                log(error);
            }
        }
    },
    get onWindowUnload() {
        return function(window) {
            if (!WindowManager.isBrowser(window)) {
                return;
            }
            try {
                ToolbarManager.removeWidget(window, 'referrercontrol-button');
            } catch(error) {
                log(error);
            }
        }
    }
};

/* bootstrap */

let install = function(data, reason) {};
let uninstall = function(data, reason) {};

let startup = function(data, reason) {
    ReferrerControl.initialize();
};

let shutdown = function(data, reason) {
    ReferrerControl.destory();
};
