"use strict";

let EXPORTED_SYMBOLS = ['ReferrerControl'];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
const log = function() { dump(Array.slice(arguments).join(' ') + '\n'); }

Cu.import('resource://referrercontrol/library/StyleManager.js');
Cu.import('resource://referrercontrol/library/WindowManager.js');
Cu.import('resource://referrercontrol/library/Widget.js');
Cu.import('resource://referrercontrol/library/ToolbarManager.js');
Cu.import('resource://referrercontrol/library/Preferences.js');
Cu.import('resource://referrercontrol/library/ChannelManager.js');
Cu.import('resource://referrercontrol/library/Utils.js');

let ReferrerControl = {

    STYLE_URI: 'chrome://referrercontrol/skin/browser.css',
    PREFERENCE_BRANCH: 'extensions.referrercontrol.',
    NAMES: ['skip', 'empty',
            'sourcehost', 'sourcedomain',
            'targethost', 'targetdomain'],

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

        StyleManager.load(ReferrerControl.STYLE_URI);
        WindowManager.initialize();
        WindowManager.run(ReferrerControl.onWindowLoad);
        WindowManager.addListener(ReferrerControl.onWindowLoad);
    },
    destory: function() {
        this.preferences.removeObserver(this);
        if (this.requestListenerAdded) {
            ChannelManager.removeObserver(this, 'http-on-modify-request');
        }
        this.requestListenerAdded = false;
        this.saveConfig();

        StyleManager.unloadAll();
        WindowManager.run(ReferrerControl.onWindowUnload);
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
        pref.setBool('firstRun', false);
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
            if (!WindowManager.isBrowser(window)) {
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
    onWindowUnload: function(window) {
        if (!WindowManager.isBrowser(window)) {
            return;
        }
        try {
            ToolbarManager.removeWidget(window, 'referrercontrol-button');
        } catch(error) {
            log(error);
        }
    }

};

