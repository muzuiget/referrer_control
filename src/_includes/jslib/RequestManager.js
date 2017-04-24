var RequestManager = (function() {

    var obsService = Cc['@mozilla.org/observer-service;1']
                          .getService(Ci.nsIObserverService);

    var REQUEST_TOPIC = 'http-on-modify-request';

    var observers = [];

    var addObserver = function(observer) {
        try {
            obsService.addObserver(observer, REQUEST_TOPIC, false);
        } catch(error) {
            trace(error);
        }
        observers.push(observers);
    };

    var removeObserver = function(observer) {
        try {
            obsService.removeObserver(observer, REQUEST_TOPIC, false);
        } catch(error) {
            trace(error);
        }
    };

    var destory = function() {
        for (var observer of observers) {
            removeObserver(observer);
        }
        observers = null;
    };

    var exports = {
        addObserver: addObserver,
        removeObserver: removeObserver,
        destory: destory,
    };
    return exports;
})();

/* exported RequestManager */
