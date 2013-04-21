"use strict";

let EXPORTED_SYMBOLS = ['ChannelManager'];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import('resource://gre/modules/Services.jsm');

const obsService = Services.obs;
const log = function() { dump(Array.slice(arguments).join(' ') + '\n'); }

let ChannelManager =  {

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
