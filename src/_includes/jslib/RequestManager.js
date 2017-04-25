var RequestManager = (function() {

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

/* exported RequestManager */
