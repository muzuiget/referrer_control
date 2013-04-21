/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const log = function() { dump(Array.slice(arguments).join(' ') + '\n'); }

const NS_XUL = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
const BROWSER_URI = 'chrome://browser/content/browser.xul';
const {classes: Cc, interfaces: Ci} = Components;

const WW = Cc['@mozilla.org/embedcomp/window-watcher;1']
             .getService(Ci.nsIWindowWatcher);
const WM = Cc['@mozilla.org/appshell/window-mediator;1']
             .getService(Ci.nsIWindowMediator);
const SSS = Cc['@mozilla.org/content/style-sheet-service;1']
              .getService(Ci.nsIStyleSheetService);
const IOS = Cc['@mozilla.org/network/io-service;1']
              .getService(Ci.nsIIOService);
const OBS = Cc['@mozilla.org/observer-service;1']
              .getService(Ci.nsIObserverService);
const PFS = Cc['@mozilla.org/preferences-service;1']
              .getService(Ci.nsIPrefService);
const ETS = Cc['@mozilla.org/network/effective-tld-service;1']
              .getService(Ci.nsIEffectiveTLDService);

const nsi = {
    SupportsString: function(data) {
        let string = Cc['@mozilla.org/supports-string;1']
                    .createInstance(Ci.nsISupportsString);
        string.data = data;
        return string;
    },
    URI: function(uri) {
        return IOS.newURI(uri, null, null);
    }
};

let StyleManager = {
    uris: [],
    load: function(uri) {
        let nsiURI = nsi.URI(uri);
        if (SSS.sheetRegistered(nsiURI, SSS.USER_SHEET)) {
            return;
        }
        SSS.loadAndRegisterSheet(nsiURI, SSS.USER_SHEET);
        this.uris.push(uri);
    },
    unload: function(uri) {
        let nsiURI = nsi.URI(uri);
        if (!SSS.sheetRegistered(nsiURI, SSS.USER_SHEET)) {
            return;
        }
        SSS.unregisterSheet(nsiURI, SSS.USER_SHEET);
        let start = this.uris.indexOf(uri);
        this.uris.splice(start, 1);
    },
    unloadAll: function() {
        for (let uri of this.uris.slice(0)) {
            this.unload(uri);
        }
    }
};

let WindowManager = {
    listeners: [],
    observe: function(window, topic) {
        if (topic !== 'domwindowopened') {
            return;
        }
        let $this = this;
        window.addEventListener('load', function(event) {
            for (let listener of $this.listeners) {
                listener(window);
            }
        }, false);
    },

    initialized: false,
    initialize: function() {
        if (this.initialized) {
            return;
        }
        this.listeners = [];
        WW.registerNotification(this);
        this.initialized = true;
    },
    destory: function() {
        if (!this.initialized) {
            return;
        }
        this.listeners = [];
        WW.unregisterNotification(this);
        this.initialized = false;
    },

    run: function(func) {
        let enumerator = WW.getWindowEnumerator();
        while (enumerator.hasMoreElements()) {
            try {
                func(enumerator.getNext());
            } catch(error) {
                log(error)
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


    getUid: function(window) {
        return window.QueryInterface(Ci.nsIInterfaceRequestor)
                     .getInterface(Ci.nsIDOMWindowUtils)
                     .outerWindowID;
    }
};

let Widget = function(window, type, attrs) {
    let widget = window.document.createElementNS(NS_XUL, type);
    if (!attrs) {
        return widget;
    }
    for (let [key, value] in Iterator(attrs)) {
        widget.setAttribute(key, value);
    }
    return widget;
};

/* start unreuse code here */

let ToolbarManager = {

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

let Preferences = function(branch) {
    let pref = PFS.getBranch(branch);

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

let ChannelManager =  {
    addObserver: function(listener, topic) {
        try {
            OBS.addObserver(listener, topic, false);
        } catch(error) {
            log(error);
        }
    },
    removeObserver: function(listener, topic) {
        try {
            OBS.removeObserver(listener, topic, false);
        } catch(error) {
            log(error);
        }
    }
};

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
            domain = ETS.getBaseDomain(uri);
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

let ReferrerControl = {

    STYLE_URI: 'chrome://referrercontrol/skin/browser.css',
    PREFERENCE_BRANCH: 'extensions.referrercontrol.',
    NAMES: ['skip', 'empty',
            'sourcehost', 'sourcedomain',
            'targethost', 'targetdomain'],

    config: {
        activated: false,
        isFirstRun: true,
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
            this.refreshButton();
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
        this.preferences = Preferences(this.PREFERENCE_BRANCH);
        this.loadPreferences();
        this.refreshRequestListener();
    },
    destory: function() {
        this.preferences.removeObserver(this);
        ChannelManager.removeObserver(this, 'http-on-modify-request');
        this.requestListenerAdded = false;
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
            let names = $this.NAMES;
            let {defaultPolicy} = $this.config;

            let menuitems = [];
            for (let name of names) {
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

    toggle: function(activated) {
        if (activated === undefined) {
            activated = !this.config.activated;
        }
        this.config.activated = activated;
        this.saveConfig();
        this.refreshButton();
        this.refreshRequestListener();
    },

    saveConfig: function() {
        let pref = this.preferences;
        let {activated, defaultPolicy} = this.config;

        pref.removeObserver(this);
        pref.setBool('activated', activated);
        pref.setString('defaultPolicy', defaultPolicy);
        pref.addObserver(this);
    },

    nameToCode: function(name) {
        return this.NAMES.indexOf(name);
    },
    codeToName: function(code) {
        return this.NAMES[code];
    },

    refreshButton: function() {
        let {activated, defaultPolicy} = this.config;
        WindowManager.run(function(window) {
            if (window.location.href !== BROWSER_URI) {
                return;
            }
            let document = window.document;
            let button = document.getElementById('referrercontrol-button');
            if (activated) {
                button.removeAttribute('disabled');
            } else {
                button.setAttribute('disabled', 'yes');
            }
            let menuitems = button.getElementsByTagName('menuitem');
            for (let menuitem of menuitems) {
                menuitem.setAttribute('checked',
                                      menuitem.value === defaultPolicy);
            }
        });
    },

    requestListenerAdded: false,
    refreshRequestListener: function() {
        if (this.config.activated) {
            if (!this.requestListenerAdded) {
                ChannelManager.addObserver(this, 'http-on-modify-request');
                this.requestListenerAdded = true;
            }
        } else {
            ChannelManager.removeObserver(this, 'http-on-modify-request');
            this.requestListenerAdded = false;
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

    get onWindowLoad() {
        let $this = this;
        return function(window) {
            if (window.location.href !== BROWSER_URI) {
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
    onWindowUnload: function(window) {
        if (window.location.href !== BROWSER_URI) {
            return;
        }
        try {
            ToolbarManager.removeWidget(window, 'referrercontrol-button');
        } catch(error) {
            log(error);
        }
    }

};

/* bootstrap entry points */

let install = function(data, reason) {};
let uninstall = function(data, reason) {};

let startup = function(data, reason) {
    ReferrerControl.initialize();
    StyleManager.load(ReferrerControl.STYLE_URI);
    WindowManager.initialize();
    WindowManager.run(ReferrerControl.onWindowLoad);
    WindowManager.addListener(ReferrerControl.onWindowLoad);
};

let shutdown = function(data, reason) {
    StyleManager.unloadAll();
    WindowManager.run(ReferrerControl.onWindowUnload);
    WindowManager.destory();
    ReferrerControl.destory();
};
