"use strict";

var {classes: Cc, interfaces: Ci} = Components;

var _ = null;
var loadLocalization = function() {
    var stringbundle = document.getElementById('referrercontrol-strings');
    _ = function(name) stringbundle.getString(name);
};

var refreshUI = function() {
    var rule = window.arguments[1];

    document.getElementById('source').value = rule.source;
    document.getElementById('target').value = rule.target;

    var valueTextbox = document.getElementById('value-textbox');
    var valueMenulist = document.getElementById('value-menulist');
    var isUrl = typeof(rule.value) === 'string';
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

var doAccept = function() {
    var source = document.getElementById('source').value.trim();
    var target = document.getElementById('target').value.trim();

    if (source === '' && target === '') {
        alert(_('sourceAndTargetEmptyWarnning'));
        return false;
    }

    var menuitemPolicy = document.getElementById('value-menulist').value.trim();
    var customUrl = document.getElementById('value-textbox').value.trim();
    var isUrl = menuitemPolicy === '-1';
    if (isUrl && customUrl === '') {
        alert(_('customUrlInvaildWarnning'));
        return false;
    }

    var comment = document.getElementById('comment').value.trim();

    var [result, rule] = window.arguments;
    result.isAccept = true;
    rule.source = source;
    rule.target = target;
    rule.value = isUrl ? customUrl : parseInt(menuitemPolicy);
    rule.comment = comment;
    return true;
};

var doCancel = function(){
    var result = window.arguments[0];
    result.isAccept = false;
    return true;
};

var onMenulistChange = function(menuitem) {
    var valueTextbox = document.getElementById('value-textbox');
    var isUrl = menuitem.value === '-1';
    if (isUrl) {
        valueTextbox.removeAttribute('disabled');
    } else {
        valueTextbox.setAttribute('disabled', true);
    }
};

var onDocumentLoad = function() {
    loadLocalization();
    refreshUI();
};
