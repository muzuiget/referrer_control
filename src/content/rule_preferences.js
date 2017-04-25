"use strict"

var {classes: Cc, interfaces: Ci, utils: Cu} = Components;
var NS_XUL = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';

/* library */

var Utils = (function() {

    Cu.import('resource://gre/modules/NetUtil.jsm');
    Cu.import('resource://gre/modules/FileUtils.jsm');

    const filePickerClass = Cc['@mozilla.org/filepicker;1'];
    const unicodeConverterClass = Cc['@mozilla.org/intl/scriptableunicodeconverter'];
    const dirService = Cc['@mozilla.org/file/directory_service;1']
                         .getService(Ci.nsIProperties);
    const windowMediator = Cc['@mozilla.org/appshell/window-mediator;1']
                              .getService(Ci.nsIWindowMediator);

    let _createFilePicker = function(mode, title, defaultName) {
        let dialog = filePickerClass.createInstance(Ci.nsIFilePicker);
        dialog.init(window, title, mode);
        dialog.defaultString = defaultName;
        dialog.displayDirectory = dirService.get('Home', Ci.nsIFile);
        return dialog;
    };

    let createOpenFilePicker = _createFilePicker.bind(
                                        this, Ci.nsIFilePicker.modeOpen);

    let createSaveFilePicker = _createFilePicker.bind(
                                        this, Ci.nsIFilePicker.modeSave);

    let _createUnicodeConverter = function() {
        return unicodeConverterClass.createInstance(Ci.nsIScriptableUnicodeConverter);
    };

    let readFileToString = function(fileObject, callback) {
        NetUtil.asyncFetch(fileObject, function(inputStream, statusCode) {
            if (!Components.isSuccessCode(statusCode)) {
                callback.fail(statusCode);
                return;
            }

            let text = NetUtil.readInputStreamToString(
                            inputStream, inputStream.available(),
                            {charset: 'UTF-8', replacement: '\ufffd'});
            callback.success(text);
        });
    };

    let writeStringToFile = function(fileObject, text, callback) {
        let outputStream = FileUtils.openSafeFileOutputStream(fileObject);
        let converter = _createUnicodeConverter();
        converter.charset = 'UTF-8';
        let inputStream = converter.convertToInputStream(text);

        NetUtil.asyncCopy(inputStream, outputStream, function(statusCode) {
            if (Components.isSuccessCode(statusCode)) {
                callback.success();
            } else {
                callback.fail(statusCode);
            }
        });
    };

    let getMostRecentWindow = windowMediator.getMostRecentWindow
                                            .bind(windowMediator);

    let exports = {
        createOpenFilePicker: createOpenFilePicker,
        createSaveFilePicker: createSaveFilePicker,
        readFileToString: readFileToString,
        writeStringToFile: writeStringToFile,
        getMostRecentWindow: getMostRecentWindow,
    }
    return exports;
})();

var Pref = function(branchRoot) {

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

/* main */

var EDITOR_XUL = 'chrome://referrercontrol/content/rule_editor.xul';
var EDITOR_NAME = 'referrercontrol:ruleeditor';
var EDITOR_FEATURES = 'chrome,modal,centerscreen';
var PREF_BRANCH = 'extensions.referrercontrol.';

// I want to rename to "rules" in later version
// but can't break compatible, maybe I need write migrate code.
var PREF_NAME_RULES = 'customRules';

var _ = null;
var loadLocalization = function() {
    let stringbundle = document.getElementById('referrercontrol-strings');
    _ = function(name) stringbundle.getString(name);
};

var policyNames = null;
var initPolicyNames = function() {
    policyNames = [_('skip'), _('remove'),
                   _('sourceHost'), _('sourceDomain'),
                   _('targetHost'), _('targetDomain'), _('targetUrl')];
};

var buildRulesFromJsonRules = function(jsonRules) {
    let rules = [];
    for (let jsonRule of jsonRules) {

        let rule = {};
        rule.source = jsonRule.source || '';
        rule.target = jsonRule.target || '';
        rule.value = jsonRule.value;
        rule.comment = jsonRule.comment || '';

        // ignore the entry if source and target both are empty
        if (rule.source || rule.target) {
            rules.push(rule);
        }
    }
    return rules;
};

var pref = Pref(PREF_BRANCH);
var Rules = (function() {
    let jsonRules = JSON.parse(pref.getString(PREF_NAME_RULES) || '[]');
    return buildRulesFromJsonRules(jsonRules);
})();

var createTreeItem = function(index, rule) {
    let treeitem = document.createElementNS(NS_XUL, 'treeitem');
    let treerow = document.createElementNS(NS_XUL, 'treerow');

    let indexCell = document.createElementNS(NS_XUL, 'treecell')
    indexCell.setAttribute('label', index);

    let sourceLabel = rule.source || '<' + _('any') + '>';
    let sourceCell = document.createElementNS(NS_XUL, 'treecell');
    sourceCell.setAttribute('label', sourceLabel);

    let targetLabel = rule.target || '<' + _('any') + '>';
    let targetCell = document.createElementNS(NS_XUL, 'treecell');
    targetCell.setAttribute('label', targetLabel);

    let isCustom = typeof(rule.value) === 'string';
    let valueLabel = isCustom ? rule.value : '<' + policyNames[rule.value] + '>';
    let valueCell = document.createElementNS(NS_XUL, 'treecell');
    valueCell.setAttribute('label', valueLabel);

    treerow.appendChild(indexCell);
    treerow.appendChild(sourceCell);
    treerow.appendChild(targetCell);
    treerow.appendChild(valueCell);
    treeitem.appendChild(treerow);
    return treeitem;
}

var updatePref = function() {
    let jsonRules = [];
    for (let rule of Rules) {
        let jsonRule = {};
        jsonRule.source = rule.source || undefined;
        jsonRule.target = rule.target || undefined;
        jsonRule.value = rule.value;
        jsonRule.comment = rule.comment || undefined;
        jsonRules.push(jsonRule);
    }

    let jsonText = JSON.stringify(jsonRules, null);
    pref.setString(PREF_NAME_RULES, jsonText);
};

var refreshUI = function() {
    // recreate the rule treeview
    let list = document.getElementById('rules-list');
    list.innerHTML = '';
    for (let i = 0; i < Rules.length; i += 1) {
        let treeitem = createTreeItem(i + 1, Rules[i]);
        list.appendChild(treeitem);
    }

    // disable some menuitems when no rules in the list
    let menuitems = document.querySelectorAll('menuitem.disable_when_empty');
    if (Rules.length == 0) {
        for (let menuitem of menuitems) {
            menuitem.setAttribute('disabled', true);
        }
    } else {
        for (let menuitem of menuitems) {
            menuitem.removeAttribute('disabled');
        }
    }
};

var openEditor = function(rule) {
    let result = {isAccept: false};
    openDialog(EDITOR_XUL, EDITOR_NAME, EDITOR_FEATURES, result, rule);
    return result.isAccept;
};

/* rule control */

var mergeRules = function(spareRules) {

    let getSameRule = function(spareRule) {
        // if "source" and "target" is same, treat as same rule
        for (let rule of Rules) {
            if (rule.source == spareRule.source &&
                    rule.target == spareRule.target) {
                return rule;
            }
        }
        return null;
    };

    for (let spareRule of spareRules) {
        let sameRule = getSameRule(spareRule);

        // if exists same rule, then update the "value" and comment,
        // otherwise just append it.
        if (sameRule) {
            sameRule.value = spareRule.value;
            sameRule.comment = spareRule.comment;
        } else {
            Rules.push(spareRule);
        }
    }

    updatePref();
    refreshUI();
};

var importRules = function(fileObject) {


    let parseRefControlRuleFile = function(text) {

        let createJsonRule = function(line) {
            let sepPos = line.indexOf('=');
            let siteString = line.slice(0, sepPos);
            let actionString = line.slice(sepPos + 1);

            let jsonRule = {};

            // convert target
            // RefControl use domain, partly match, but Referrer Control use
            // full match, so convert site string
            //     google.com
            // to regular expression
            //     '^https?://(?:[^/]+\\.)*google\\.com/.*$'
            // more detail see
            //     https://github.com/muzuiget/referrer_control/issues/23
            // also need to wrap with "/", let the rule parser treat it as
            // regular expression.
            let targetTpl = '/^https?://(?:[^/]+\\.)*${domain}/.*$/';
            let domain = siteString.replace(/\./g, '\\.');
            jsonRule.target = targetTpl.replace('${domain}', domain);

            // convert policy
            // Referrer Control handle third-party request globally,
            // so ignore the setting in RefControl
            let action;
            if (actionString.startsWith('@3RDPARTY:')) {
                action = actionString.replace('@3RDPARTY:', '');
            } else {
                action = actionString;
            }
            switch (action) {

                case '@NORMAL':
                    jsonRule.value = 0; // skip
                    break;

                case '@FORGE':
                    jsonRule.value = 4; // targetHost
                    break;

                case '':
                    jsonRule.value = 1; // remove
                    break;

                default:
                    jsonRule.value = action; // customUrl
                    break;
            }

            // add the line content to comment let user know this rule
            // is convert from RefControl rule file
            jsonRule.comment = 'RefControl: ' + line;

            return jsonRule;
        };

        let lines = text.split('\n')
                        .map(function(s) s.trim()) // remove spaces
                        .slice(1) // skip first line '[RefControl]'
                        .filter(function(s) s !== ''); // remove empty lines
        let jsonRules = lines.map(createJsonRule);
        return jsonRules;
    }

    let callback = {
        success: function(text) {
            let jsonRules;
            try {
                if (text.startsWith('[RefControl]')) {
                    jsonRules = parseRefControlRuleFile(text);
                } else {
                    jsonRules = JSON.parse(text).rules;
                }
            } catch(error) {
                Cu.reportError(error);
                alert(_('notAvaiableRuleFile'));
                return;
            }

            let spareRules;
            if (jsonRules && jsonRules.length > 0) {
                spareRules = buildRulesFromJsonRules(jsonRules);
            } else {
                spareRules = [];
            }

            if (spareRules.length == 0) {
                alert(_('notAvaiableRuleFile'));
                return;
            }

            mergeRules(spareRules);
        },

        fail: function(statusCode) {
            alert(_('readFileFail').replace('${code}', statusCode));
        },
    };

    Utils.readFileToString(fileObject, callback);

};

var exportRules = function(fileObject) {

    let jsonObject = {
        title: _('ruleFileTitle'),
        date: (new Date()).toLocaleFormat('%Y-%m-%d %H:%M:%S'),
        rules: Rules,
    };
    let jsonText = JSON.stringify(jsonObject, null, '    ');

    let callback = {
        success: function() {},
        fail: function(statusCode) {
            alert(_('writeFileFail').replace('${code}', statusCode));
        },
    };

    Utils.writeStringToFile(fileObject, jsonText, callback);

};

var moveUpRule = function(index) {
    if (index === 0) {
        return;
    }

    let p = index - 1;
    let i = index;
    [Rules[p], Rules[i]] = [Rules[i], Rules[p]];

    updatePref();
    refreshUI();
};

var moveDownRule = function(index) {
    if (index === Rules.length - 1) {
        return;
    }

    let n = index + 1;
    let i = index;
    [Rules[n], Rules[i]] = [Rules[i], Rules[n]];

    updatePref();
    refreshUI();
};

var moveToTopRule = function(index) {
    if (index === 0) {
        return;
    }

    let rule = Rules.splice(index, 1)[0];
    Rules.unshift(rule);

    updatePref();
    refreshUI();
};

var moveToBottomRule = function(index) {
    if (index === Rules.length - 1) {
        return;
    }

    let rule = Rules.splice(index, 1)[0];
    Rules.push(rule);

    updatePref();
    refreshUI();
};

var newRule = function() {
    let rule = {
        source: '',
        target: '',
        value: 1, // the "remove" policy
        comment: '',
    }

    if (!openEditor(rule)) {
        return;
    }

    Rules.push(rule);
    updatePref();
    refreshUI();
};

var editRule = function(index) {
    let rule = Rules[index];

    if (!openEditor(rule)) {
        return;
    }

    updatePref();
    refreshUI();
};

var removeRule = function(index) {
    Rules.splice(index, 1);
    updatePref();
    refreshUI();
};

var clearRules = function() {
    let response = confirm(_('clearRulesWarnning'));
    if (!response) {
        return;
    }
    Rules = [];
    updatePref();
    refreshUI();
};

/* content-menu */

// import/export

var DEFAULT_FILENAME = 'referrer_control.json';

var lastSelectedFile = null;

var importDialog = null;
var onImportCommand = function() {
    if (!importDialog) {
        importDialog = Utils.createOpenFilePicker(_('importTitle'), DEFAULT_FILENAME);

        // *.txt is for RefControl rule file
        importDialog.appendFilter(_('ruleFiles'), '*.json; *.txt');
    }

    if (lastSelectedFile) {
        importDialog.displayDirectory = lastSelectedFile.parent;
    }

    importDialog.open(function(result) {
        lastSelectedFile = importDialog.file;
        if (result != Ci.nsIFilePicker.returnCancel) {
            importRules(importDialog.file);
        }
    });
};

var exportDialog = null;
var onExportCommand = function() {
    if (!exportDialog) {
        exportDialog = Utils.createSaveFilePicker(_('exportTitle'), DEFAULT_FILENAME);
        exportDialog.appendFilter(_('ruleFiles'), '*.json');
    }

    if (lastSelectedFile) {
        exportDialog.displayDirectory = lastSelectedFile.parent;
    }

    exportDialog.open(function(result) {
        lastSelectedFile = exportDialog.file;
        if (result != Ci.nsIFilePicker.returnCancel) {
            exportRules(exportDialog.file);
        }
    });
};

// movement

var onMoveUpCommand = function() {
    let treeview = document.getElementById('rules-tree').view;
    let index = treeview.selection.currentIndex;
    if (index !== -1) {
        moveUpRule(index);
    }
};

var onMoveDownCommand = function() {
    let treeview = document.getElementById('rules-tree').view;
    let index = treeview.selection.currentIndex;
    if (index !== -1) {
        moveDownRule(index);
    }
};

var onMoveToTopCommand = function() {
    let treeview = document.getElementById('rules-tree').view;
    let index = treeview.selection.currentIndex;
    if (index !== -1) {
        moveToTopRule(index);
    }
};

var onMoveToBottomCommand = function() {
    let treeview = document.getElementById('rules-tree').view;
    let index = treeview.selection.currentIndex;
    if (index !== -1) {
        moveToBottomRule(index);
    }
};

// CRUD

var onNewCommand = function() {
    newRule();
};

var onEditCommand = function() {
    let treeview = document.getElementById('rules-tree').view;
    let index = treeview.selection.currentIndex;
    if (index !== -1) {
        editRule(index);
    }
};

var onRemoveCommand = function() {
    let treeview = document.getElementById('rules-tree').view;
    let index = treeview.selection.currentIndex;
    if (index !== -1) {
        removeRule(index);
    }
};

var onClearCommand = function() {
    clearRules();
};

/* others */

var onTreeDblclick = function(event) {
    let index = event.target._lastSelectedRow;
    if (index === undefined || index < 0) {
        return;
    }
    editRule(index);
};

var doHelp = function() {
    let helpUrl = 'https://github.com/muzuiget/referrer_control/wiki#rules';
    let browserWindow = Utils.getMostRecentWindow('navigator:browser');
    if (browserWindow) {
        let gBrowser = browserWindow.gBrowser;
        gBrowser.selectedTab = gBrowser.addTab(helpUrl);
    } else {
        window.open(helpUrl);
    }
    return false;
};

var onDocumentLoad = function() {
    loadLocalization();
    initPolicyNames();
    refreshUI();
};
