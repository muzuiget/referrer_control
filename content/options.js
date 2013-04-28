"use strict"

const {classes: Cc, interfaces: Ci} = Components;

/* library */

const Pref = function(branchRoot) {

    const supportsStringClass = Cc['@mozilla.org/supports-string;1'];
    const prefService = Cc['@mozilla.org/preferences-service;1']
                           .getService(Ci.nsIPrefService);

    const new_nsiSupportsString = function(data) {
        let string = supportsStringClass.createInstance(Ci.nsISupportsString);
        string.data = data;
        return string;
    };

    let branch = prefService.getBranch(branchRoot);

    let setString = function(key, value) {
        branch.setComplexValue(key, Ci.nsISupportsString,
                               new_nsiSupportsString(value));
    };
    let getString = function(key, defaultValue) {
        let value;
        try {
            value = branch.getComplexValue(key, Ci.nsISupportsString).data;
        } catch(error) {
            value = defaultValue || null;
        }
        return value;
    };

    let exports = {
        setString: setString,
        getString: getString,
    }
    return exports;
};

const Widget = function(type, attrs) {

    const NS_XUL = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';

    if (type.trim() === 'script') {
        throw 'Type should not be script';
    }

    let widget = document.createElementNS(NS_XUL, type);
    if (attrs) {
        for (let [key, value] in Iterator(attrs)) {
            widget.setAttribute(key, value);
        }
    }
    return widget;
};

/* main */

const EDITOR_XUL = 'chrome://referrercontrol/content/editor.xul';
const EDITOR_NAME = 'referrercontrol:ruleeditor';
const EDITOR_FEATURES = 'chrome,modal,centerscreen';
const PREF_BRANCH = 'extensions.referrercontrol.';

let _ = null;
let loadLocalization = function() {
    let stringbundle = document.getElementById('strings');
    _ = function(name) stringbundle.getString(name);
};

let policyNames = null;
let initPolicyNames = function() {
    policyNames = [_('skip'), _('remove'),
                   _('sourceHost'), _('sourceDomain'),
                   _('targetHost'), _('targetDomain')];
};

let pref = Pref(PREF_BRANCH);
let customRules = (function() {
    let jsonRules = JSON.parse(pref.getString('customRules') || '[]');
    let customRules = [];
    for (let jsonRule of jsonRules) {
        let customRule = {};
        customRule.source = jsonRule.source || '';
        customRule.target = jsonRule.target || '';
        customRule.value = jsonRule.value;
        customRule.comment = jsonRule.comment || '';
        customRules.push(customRule);
    }
    return customRules;
})();

let createTreeItem = function(index, rule) {
    let treeitem = Widget('treeitem');
    let treerow = Widget('treerow');

    let indexCell = Widget('treecell', {label: index});

    let sourceLabel = rule.source || '<' + _('any') + '>';
    let sourceCell = Widget('treecell', {label: sourceLabel});

    let targetLabel = rule.target || '<' + _('any') + '>';
    let targetCell = Widget('treecell', {label: targetLabel});

    let isCustom = typeof(rule.value) === 'string';
    let valueLabel = isCustom ? rule.value : '<' + policyNames[rule.value] + '>';
    let valueCell = Widget('treecell', {label: valueLabel});

    treerow.appendChild(indexCell);
    treerow.appendChild(sourceCell);
    treerow.appendChild(targetCell);
    treerow.appendChild(valueCell);
    treeitem.appendChild(treerow);
    return treeitem;
}

let savePref = function() {
    let jsonRules = [];
    for (let customRule of customRules) {
        let jsonRule = {};
        jsonRule.source = customRule.source || undefined;
        jsonRule.target = customRule.target || undefined;
        jsonRule.value = customRule.value;
        jsonRule.comment = customRule.comment || undefined;
        jsonRules.push(jsonRule);
    }

    let jsonText = JSON.stringify(jsonRules, null, '    ');
    pref.setString('customRules', jsonText);
};

let updatePref = function() {
    // follow platform convention
    if (document.documentElement.instantApply) {
        savePref();
    }
};

let refreshUI = function() {
    let list = document.getElementById('customRules-list');
    list.innerHTML = '';
    for (let i = 0; i < customRules.length; i += 1) {
        let treeitem = createTreeItem(i + 1, customRules[i]);
        list.appendChild(treeitem);
    }
};

let openEditor = function(rule) {
    let result = {isAccept: false};
    openDialog(EDITOR_XUL, EDITOR_NAME, EDITOR_FEATURES, result, rule);
    return result.isAccept;
};

/* rule control */

let newRule = function() {
    let rule = {
        source: '',
        target: '',
        value: 1, // remove
        comment: '',
    }

    if (!openEditor(rule)) {
        return;
    }

    customRules.push(rule);
    updatePref();
    refreshUI();
};

let editRule = function(index) {
    let rule = customRules[index];

    if (!openEditor(rule)) {
        return;
    }

    updatePref();
    refreshUI();
};

let removeRule = function(index) {
    customRules.splice(index, 1);
    updatePref();
    refreshUI();
};

let clearRules = function() {
    let response = confirm(_('clearRulesWarnning'));
    if (!response) {
        return;
    }
    customRules = [];
    updatePref();
    refreshUI();
};

/* content-menu */

let onNewCommand = function() {
    newRule();
};

let onEditCommand = function() {
    let treeview = document.getElementById('customRules-tree').view;
    let index = treeview.selection.currentIndex;
    editRule(index);
};

let onRemoveCommand = function() {
    let treeview = document.getElementById('customRules-tree').view;
    let index = treeview.selection.currentIndex;
    removeRule(index);
};

let onClearCommand = function() {
    clearRules();
};

/* others */

let onTreeDblclick = function(event) {
    let index = event.target._lastSelectedRow;
    if (index === -1) {
        return;
    }
    editRule(index);
};

let doAccept = function() {
    savePref();
};

let onDocumentLoad = function() {
    loadLocalization();
    initPolicyNames();
    refreshUI();
};
