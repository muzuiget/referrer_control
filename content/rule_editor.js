"use strict";

const {classes: Cc, interfaces: Ci} = Components;
const windowMediator = Cc['@mozilla.org/appshell/window-mediator;1']
                          .getService(Ci.nsIWindowMediator);

let _ = null;
let loadLocalization = function() {
    let stringbundle = document.getElementById('referrercontrol-strings');
    _ = function(name) stringbundle.getString(name);
};

let refreshUI = function() {
    let rule = window.arguments[1];

    document.getElementById('source').value = rule.source;
    document.getElementById('target').value = rule.target;

    let valueTextbox = document.getElementById('value-textbox');
    let valueMenulist = document.getElementById('value-menulist');
    let isUrl = typeof(rule.value) === 'string';
    if (isUrl) {
        valueTextbox.removeAttribute('disabled');
        valueTextbox.value = rule.value;
        valueMenulist.value = '-1';
    } else {
        valueTextbox.setAttribute('disabled', true);
        valueMenulist.value = String(rule.value);
    }

    document.getElementById('comment').value = rule.comment;
};

let doAccept = function() {
    let source = document.getElementById('source').value.trim();
    let target = document.getElementById('target').value.trim();

    if (source === '' && target === '') {
        alert(_('sourceAndTargetEmptyWarnning'));
        return false;
    }

    let menuitemPolicy = document.getElementById('value-menulist').value.trim();
    let customUrl = document.getElementById('value-textbox').value.trim();
    let isUrl = menuitemPolicy === '-1';
    if (isUrl && customUrl === '') {
        alert(_('customUrlInvaildWarnning'));
        return false;
    }

    let comment = document.getElementById('comment').value.trim();

    let [result, rule] = window.arguments;
    result.isAccept = true;
    rule.source = source;
    rule.target = target;
    rule.value = isUrl ? customUrl : parseInt(menuitemPolicy);
    rule.comment = comment;
    return true;
};

let doHelp = function() {
    let helpUrl = 'https://github.com/muzuiget/referrer_control/wiki#custom-rules';
    let browserWindow = windowMediator.getMostRecentWindow('navigator:browser');
    if (browserWindow) {
        let gBrowser = browserWindow.gBrowser;
        gBrowser.selectedTab = gBrowser.addTab(helpUrl);
    } else {
        window.open(helpUrl);
    }
    return false;
};

let doCancel = function(){
    let result = window.arguments[0];
    result.isAccept = false;
    return true;
};

let onMenulistChange = function(menuitem) {
    let valueTextbox = document.getElementById('value-textbox');
    let isUrl = menuitem.value === '-1';
    if (isUrl) {
        valueTextbox.removeAttribute('disabled');
    } else {
        valueTextbox.setAttribute('disabled', true);
    }
};

let onDocumentLoad = function() {
    loadLocalization();
    refreshUI();
};
