var BrowserManager = (function() {

    var windowWatcher = Cc['@mozilla.org/embedcomp/window-watcher;1']
                             .getService(Ci.nsIWindowWatcher);

    var BROWSER_URI = 'chrome://browser/content/browser.xul';

    var listeners = [];

    var onload = function(event) {
        for (var listener of listeners) {
            var window = event.currentTarget;
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

    var observer = {
        observe: function(window, topic, data) {
            if (topic !== 'domwindowopened') {
                return;
            }
            window.addEventListener('load', onload);
        }
    };

    var run = function(func, uri) {
        var enumerator = windowWatcher.getWindowEnumerator();
        while (enumerator.hasMoreElements()) {
            var window = enumerator.getNext();
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

    var addListener = function(listener) {
        listeners.push(listener);
    };

    var removeListener = function(listener) {
        var start = listeners.indexOf(listener);
        if (start !== -1) {
            listeners.splice(start, 1);
        }
    };

    var initialize = function() {
        windowWatcher.registerNotification(observer);
    };

    var destory = function() {
        windowWatcher.unregisterNotification(observer);
        listeners = null;
    };

    initialize();

    var exports = {
        run: run,
        addListener: addListener,
        removeListener: removeListener,
        destory: destory,
    };
    return exports;
})();

/* exported BrowserManager */
