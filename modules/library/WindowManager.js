"use strict";

let EXPORTED_SYMBOLS = ['WindowManager'];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import('resource://gre/modules/Services.jsm');

const BROWSER_URI = 'chrome://browser/content/browser.xul';
const OBSERVER_NAME = 'chrome-document-global-created';
const windowWatcher = Services.ww;
const obsService = Services.obs;
const log = function() { dump(Array.slice(arguments).join(' ') + '\n'); }

let WindowManager = {

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
