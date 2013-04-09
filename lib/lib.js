const {Cc, Ci} = require('chrome');
const {MatchPattern} = require('sdk/page-mod/match-pattern');
const tabsHelpers = require('sdk/tabs/helpers');
const winUtils = require('sdk/window/utils');
const tabs = require('sdk/tabs');

// utils
let eTLDService = Cc['@mozilla.org/network/effective-tld-service;1']
                  .getService(Ci.nsIEffectiveTLDService);
let domainPrePath = function(uri) {
    let domain;
    try {
        domain = eTLDService.getBaseDomain(uri);
    } catch (e) {
        domain = uri.asciiHost; // ip
    }
    return uri.scheme + '://' + domain + '/';
};

let createChanger = function(ruleText) {

    // tab status
    let disabledTabs = {};
    let disableTab = function(x) disabledTabs[x] = true;
    let enableTab = function(x) delete disabledTabs[x];
    let isEnabledTab = function(x) disabledTabs[x] !== true;

    // rule handle
    let fakeMatchPattern = {test: function(x) true};
    let rules = JSON.parse(ruleText);
    rules.forEach(function(rule) {
        if (rule.from === undefined) {
            rule.from = fakeMatchPattern;
        } else {
            rule.from = new MatchPattern(rule.from);
        }
        if (rule.to === undefined) {
            rule.to = fakeMatchPattern;
        } else {
            rule.to = new MatchPattern(rule.to);
        }
    });

    let findMatchRule = function(originalUrl, referrerUrl) {
        for (let rule of rules) {
            if (rule.from.test(referrerUrl) && rule.to.test(originalUrl)) {
                return rule;
            }
        }
        return null;
    };

    let makeReferrer = function(channel) {
        let originalURI = channel.originalURI;
        let referrerURI = channel.referrer;

        let rule = findMatchRule(originalURI.spec, referrerURI.spec);
        if (!rule) {
            return originalURI.prePath + '/'; // default '@host'
        }

        let value = rule.value;

        // direct string
        if (!value.startsWith('@')) {
            return value;
        }

        // meta string
        if (value === '@skip') {
            return null;
        }
        if (value === '@domain') {
            return domainPrePath(originalURI);
        }
        // invalid also treat as '@host'
        return originalURI.prePath + '/';
    };

    let isFromEnabledTab = function(channel) {
        let loadContext;
        try {
            loadContext = channel.notificationCallbacks
                                 .getInterface(Ci.nsILoadContext);
        } catch (e) {
            try {
                loadContext = channel.loadGroup.notificationCallbacks
                                     .getInterface(Ci.nsILoadContext);
            } catch (e) {
                loadContext = null;
            }
        }

        if (!loadContext) {
            return false;
        }

        let tab = tabsHelpers.getTabForWindow(loadContext.topWindow);
        if (!tab) {
            return false;
        }

        return isEnabledTab(tab.id);
    };

    let api = {
        enableTab: enableTab,
        disableTab: disableTab,
        isEnabledTab: isEnabledTab,
        isFromEnabledTab: isFromEnabledTab,
        makeReferrer: makeReferrer,
    };
    return api;
};

exports.createChanger = createChanger;
