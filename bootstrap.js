/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const log = function() { dump(Array.slice(arguments).join(' ') + '\n'); }

/* bootstrap entry points */

let install = function(data, reason) {};
let uninstall = function(data, reason) {};

let startup = function(data, reason) {
    log('startup');
};

let shutdown = function(data, reason) {
    log('shutdown');
};
