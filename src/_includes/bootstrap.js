/* main */

var _ = null;
var loadLocalization = function() {
    _ = Utils.localization('referrercontrol', 'global');
};

var ruleCompiler = function(text) {
    if (!text.trim()) {
        return [];
    }

    let items;
    try {
        items = JSON.parse(text);
    } catch(error) {
        trace(error);
        return [];
    }

    let toRegExp = Utils.wildcard2RegExp;
    let fakeRegExp = Utils.fakeTrueTest;

    let rules = [];
    for (let item of items) {
        let {source, target, value} = item;
        let rule = {};

        rule.source = source && toRegExp(source) || fakeRegExp;
        rule.target = target && toRegExp(target) || fakeRegExp;
        if (typeof(value) === 'string') {
            rule.isUrl = true;
            rule.url = value;
        } else {
            rule.isUrl = false;
            rule.code = value;
        }
        rules.push(rule);
    }
    return rules;
};

var Referrer = (function() {

    let toUrl = function(sourceURI, targetURI, policy) {
        // When sourceURI is null, that is original Referer is blank.
        // So policy "source host" and "source domain" is meaningless,
        // just treat as "remove".
        if (!sourceURI && (policy === 2 || policy === 3)) {
            return '';
        }

        let value;
        switch (policy) {
            case 0: // skip
                return null;
            case 1: // remove
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
            case 6: // target url
                return targetURI.spec;
            default:
                return null;
        }

        let scheme = sourceURI && sourceURI.scheme || targetURI.scheme;
        return scheme + '://' + value + '/';
    };

    let debugResult = function(sourceURI, targetURI, result) {
        console.group();
        console.log('source', sourceURI && sourceURI.spec || ''),
        console.log('target', targetURI.spec),
        console.log('result', result),
        console.groupEnd();
    };

    let getFor = function(sourceURI, targetURI, rules, policy) {
        for (let rule of rules) {
            let {source, target, isUrl, url, code} = rule;

            let isMatch;
            if (sourceURI) {
                isMatch = source.test(sourceURI.spec) &&
                                target.test(targetURI.spec);
            } else {
                isMatch = target.test(targetURI.spec);
            }

            if (isMatch) {
                if (isUrl) {
                    return url;
                } else {
                    return toUrl(sourceURI, targetURI, code);
                }
            }
        }
        // Does not match any custom rule, use the default policy
        return toUrl(sourceURI, targetURI, policy);
    };

    let debugGetFor = function(sourceURI, targetURI, rules, policy) {
        let result = getFor(sourceURI, targetURI, rules, policy);
        debugResult(sourceURI, targetURI, result);
        return result;
    };

    let exports = {
        //getFor: getFor,
        getFor: debugGetFor,
    }
    return exports;
})();

var ReferrerControl = function() {

    const EXTENSION_ID = 'referrercontrol@qixinglu.com';
    const EXTENSION_NAME = 'Referrer Control';
    const BUTTON_ID = 'referrercontrol-button';
    const STYLE_URI = 'chrome://referrercontrol/skin/browser.css';
    const PREF_BRANCH = 'extensions.referrercontrol.';

    // I want to rename to "rules" in later version
    // but can't break compatible, maybe I need write migrate code.
    const PREF_NAME_RULES = 'customRules';

    const POLICIES = [
        [0, 'skip'],
        [1, 'remove'],
        [2, 'sourceHost'],
        [3, 'sourceDomain'],
        [4, 'targetHost'],
        [5, 'targetDomain'],
        [6, 'targetUrl']
    ];
    const ACTIVATED_TOOLTIPTEXT = EXTENSION_NAME + '\n' +
                                  _('activatedTooltip');
    const DEACTIVATED_TOOLTIPTEXT = EXTENSION_NAME + '\n' +
                                    _('deactivatedTooltip');

    let config = {
        firstRun: true,
        activated: true,
        ignoreBlankSource: true,
        ignoreSameDomains: true,
        strictSameDomains: false,
        defaultPolicy: 1, // the "remove" policy
        rules: [],
    };
    let pref = Pref(PREF_BRANCH);

    let prefObserver;
    let reqObserver;
    let extObserver;
    let toolbarButtons;

    prefObserver = {

        observe: function(subject, topic, data) {
            this.reloadConfig();
            reqObserver.refresh();
            toolbarButtons.refresh();
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
        initComplex: function(name, pref_name, converter, defaultValue) {
            let text = pref.getString(pref_name);
            if (text === null) {
                pref.setString(name, defaultValue);
                config[name] = converter(defaultValue);
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
        loadComplex: function(name, pref_name, converter) {
            let text = pref.getString(pref_name);
            if (text !== null) {
                config[name] = converter(text);
            }
        },

        initConfig: function() {
            let {initBool, initInt, initComplex} = this;
            initBool('firstRun');
            initBool('activated');
            initBool('ignoreBlankSource');
            initBool('ignoreSameDomains');
            initBool('strictSameDomains');
            initInt('defaultPolicy');
            initComplex('rules', PREF_NAME_RULES, ruleCompiler, '[]');
        },
        reloadConfig: function() {
            let {loadBool, loadInt, loadComplex} = this;
            loadBool('firstRun');
            loadBool('activated');
            loadBool('ignoreBlankSource');
            loadBool('ignoreSameDomains');
            loadBool('strictSameDomains');
            loadInt('defaultPolicy');
            loadComplex('rules', PREF_NAME_RULES, ruleCompiler);
        },
        saveConfig: function() {
            this.stop(); // avoid recursion

            pref.setBool('firstRun', false);
            pref.setBool('activated', config.activated);
            pref.setInt('defaultPolicy', config.defaultPolicy);

            this.start();
        }
    };

    reqObserver = {

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
            let {
                ignoreBlankSource,
                ignoreSameDomains,
                strictSameDomains,
                defaultPolicy,
                rules
            } = config;

            if (ignoreBlankSource && !channel.referrer) {
                return;
            }

            let targetURI = channel.URI;
            let sourceURI = null;

            if (channel.referrer) {
                sourceURI = channel.referrer;

                // ignore same domains
                if (ignoreSameDomains &&
                        Utils.isSameDomains(sourceURI, targetURI,
                                            strictSameDomains)) {
                    return;
                }
            }

            // now find override referrer string
            let referrer = Referrer.getFor(
                                sourceURI, targetURI, rules, defaultPolicy);
            if (referrer === null) {
                return;
            }

            channel.setRequestHeader('Referer', referrer, false);
        }
    };

    extObserver = {

        observing: false,

        observe: function(subject, topic, data) {
            if (data !== EXTENSION_ID) {
                return;
            }
            try {
                let document = subject.QueryInterface(Ci.nsIDOMDocument);
                let button = document.getElementById('rule-preferences');
                button.addEventListener('command', this.openRuleDialog);
            } catch(error) {
                trace(error);
            }
        },

        start: function() {
            if (!this.observing) {
                ExtensionManager.addObserver(this);
                this.observing = true;
            }
        },
        stop: function() {
            if (this.observing) {
                ExtensionManager.removeObserver(this);
                this.observing = false;
            }
        },

        openRuleDialog: function(event) {
            let dialog = Utils.getMostRecentWindow(
                                        'ReferrerControl:Rule Preferences');
            if (dialog) {
                dialog.focus();
            } else {
                let window = event.target.ownerDocument.defaultView;
                window.openDialog(
                    'chrome://referrercontrol/content/rule_preferences.xul', '',
                    'chrome,titlebar,toolbar,centerscreen,resizable,dialog=no');
            }
        },
    };

    toolbarButtons = {

        refresh: function() {
            let {activated, defaultPolicy} = config;
            BrowserManager.run(function(window) {
                let document = window.document;
                let button = document.getElementById(BUTTON_ID);
                if (activated) {
                    button.removeAttribute('disabled');
                    button.setAttribute('tooltiptext', ACTIVATED_TOOLTIPTEXT);
                } else {
                    button.setAttribute('disabled', 'yes');
                    button.setAttribute('tooltiptext', DEACTIVATED_TOOLTIPTEXT);
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
            prefObserver.saveConfig();
            reqObserver.refresh();
            this.refresh();
        },

        createButtonCommand: function() {
            let that = this; // damn it
            return function(event) {

                let target = event.target;

                // click menuitem auto activate button
                if (target === this) {
                    that.toggle();
                    return;
                }

                // event fire from policyMenuitem
                if (target.className === 'policy') {
                    that.toggle(true);
                }
            }
        },

        onPrefMenuitemCommand: function(event) {
            extObserver.openRuleDialog(event);
        },
        onPolicyMenuitemCommand: function(event) {
            config.defaultPolicy = parseInt(event.target.getAttribute('value'));
        },

        createInstance: function(window) {
            let document = window.document;

            let createButton = function() {
                let attrs = {
                    id: BUTTON_ID,
                    'class': 'toolbarbutton-1 chromeclass-toolbar-additional',
                    type: 'menu-button',
                    removable: true,
                    label: EXTENSION_NAME,
                    tooltiptext: EXTENSION_NAME,
                };
                if (config.activated) {
                    attrs.tooltiptext = ACTIVATED_TOOLTIPTEXT;
                } else {
                    attrs.disabled = 'yes';
                    attrs.tooltiptext = DEACTIVATED_TOOLTIPTEXT;
                }
                let button = document.createElementNS(NS_XUL, 'toolbarbutton');
                Utils.setAttrs(button, attrs);
                return button;
            };

            let createMenupopup = function() {
                return document.createElementNS(NS_XUL, 'menupopup');
            };

            let createPrefMenuitem = function() {
                let menuitem = document.createElementNS(NS_XUL, 'menuitem');
                menuitem.setAttribute('class', 'pref');
                menuitem.setAttribute('label', _('openRulePreferences') + '...');
                return menuitem;
            };

            let createPolicyMenuitems = function() {
                let {defaultPolicy} = config;
                let menuitems = [];
                for (let [code, name] of POLICIES) {
                    let attrs = {
                        'class': 'policy',
                        label: _(name),
                        value: code,
                        name: 'referrercontrol-policy',
                        type: 'radio',
                        tooltiptext: _(name + 'Tooltip'),
                        checked: code === defaultPolicy,
                    };
                    let menuitem = document.createElementNS(NS_XUL, 'menuitem');
                    Utils.setAttrs(menuitem, attrs);
                    menuitems.push(menuitem);
                }
                return menuitems;
            };

            let menupopup = createMenupopup();

            let prefMenuitem = createPrefMenuitem();
            prefMenuitem.addEventListener('command',
                                          this.onPrefMenuitemCommand);
            let menusep = document.createElementNS(NS_XUL, 'menuseparator');

            menupopup.appendChild(prefMenuitem);
            menupopup.appendChild(menusep);

            for (let menuitem of createPolicyMenuitems()) {
                menuitem.addEventListener('command',
                                          this.onPolicyMenuitemCommand);
                menupopup.appendChild(menuitem);
            }

            let button = createButton();
            button.addEventListener('command', this.createButtonCommand());
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
            ToolbarManager.removeWidget(window, BUTTON_ID);
        } catch(error) {
            trace(error);
        }
    };

    let initialize = function() {
        prefObserver.initConfig();
        prefObserver.start();
        reqObserver.refresh();
        extObserver.start();

        BrowserManager.run(insertToolbarButton);
        BrowserManager.addListener(insertToolbarButton);
        StyleManager.load(STYLE_URI);
    };
    let destory = function() {
        prefObserver.saveConfig();
        prefObserver.stop();
        reqObserver.stop();
        extObserver.stop();

        BrowserManager.run(removeToolbarButton);
        BrowserManager.destory();
        StyleManager.destory();
    };

    let exports = {
        initialize: initialize,
        destory: destory,
    }
    return exports;
};

/* bootstrap */

var referrerControl;

var install = function(data, reason) {};
var uninstall = function(data, reason) {};

var startup = function(data, reason) {
    loadLocalization();
    referrerControl = ReferrerControl();
    referrerControl.initialize();
};

var shutdown = function(data, reason) {
    referrerControl.destory();
};
