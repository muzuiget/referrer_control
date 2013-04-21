"use strict";

let EXPORTED_SYMBOLS = ['WindowManager'];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import('resource://gre/modules/Services.jsm');

const BROWSER_URI = 'chrome://browser/content/browser.xul';
const windowWatcher = Services.ww;
const log = function() { dump(Array.slice(arguments).join(' ') + '\n'); }

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
        windowWatcher.registerNotification(this);
        this.initialized = true;
    },
    destory: function() {
        if (!this.initialized) {
            return;
        }
        this.listeners = [];
        windowWatcher.unregisterNotification(this);
        this.initialized = false;
    },

    run: function(func) {
        let enumerator = windowWatcher.getWindowEnumerator();
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
    },

    isBrowser: function(window) {
        return window.location.href === BROWSER_URI;
    }
};
