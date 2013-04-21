/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import('resource://gre/modules/Services.jsm');

const MODULES = [
    'resource://referrercontrol/library/StyleManager.js',
    'resource://referrercontrol/library/WindowManager.js',
    'resource://referrercontrol/library/Widget.js',
    'resource://referrercontrol/library/ToolbarManager.js',
    'resource://referrercontrol/library/Preferences.js',
    'resource://referrercontrol/library/ChannelManager.js',
    'resource://referrercontrol/library/Utils.js',
    'resource://referrercontrol/ReferrerControl.js'
];

const ioService = Services.io;
const log = function() { dump(Array.slice(arguments).join(' ') + '\n'); }
const loadResource = function(name, folder) {
    let resource = ioService.getProtocolHandler('resource')
                            .QueryInterface(Ci.nsIResProtocolHandler);
    let path = __SCRIPT_URI_SPEC__ + '/../' + folder + '/';
    let resourceURI = ioService.newURI(path, null, null);
    resource.setSubstitution(name, resourceURI);
    resource.setSubstitution('moduleloader', resourceURI);
}

/* bootstrap entry points */

let install = function(data, reason) {};
let uninstall = function(data, reason) {};

let startup = function(data, reason) {
    loadResource('referrercontrol', 'modules');
    Cu.import('resource://referrercontrol/ReferrerControl.js');
    ReferrerControl.initialize();
};

let shutdown = function(data, reason) {
    ReferrerControl.destory();
    MODULES.forEach(Cu.unload, Cu);
};
