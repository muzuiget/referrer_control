"use strict"

var {classes: Cc, interfaces: Ci, utils: Cu} = Components;
var NS_XUL = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';

/* library */

var Utils = (function() {

    Cu.import('resource://gre/modules/NetUtil.jsm');
    Cu.import('resource://gre/modules/FileUtils.jsm');

    var filePickerClass = Cc['@mozilla.org/filepicker;1'];
    var unicodeConverterClass = Cc['@mozilla.org/intl/scriptableunicodeconverter'];
    var dirService = Cc['@mozilla.org/file/directory_service;1']
                         .getService(Ci.nsIProperties);
    var windowMediator = Cc['@mozilla.org/appshell/window-mediator;1']
                              .getService(Ci.nsIWindowMediator);

    var _createFilePicker = function(mode, title, defaultName) {
        var dialog = filePickerClass.createInstance(Ci.nsIFilePicker);
        dialog.init(window, title, mode);
        dialog.defaultString = defaultName;
        dialog.displayDirectory = dirService.get('Home', Ci.nsIFile);
        return dialog;
    };

    var createOpenFilePicker = _createFilePicker.bind(
                                        this, Ci.nsIFilePicker.modeOpen);

    var createSaveFilePicker = _createFilePicker.bind(
                                        this, Ci.nsIFilePicker.modeSave);

    var _createUnicodeConverter = function() {
        return unicodeConverterClass.createInstance(Ci.nsIScriptableUnicodeConverter);
    };

    var readFileToString = function(fileObject, callback) {
        NetUtil.asyncFetch(fileObject, function(inputStream, statusCode) {
            if (!Components.isSuccessCode(statusCode)) {
                callback.fail(statusCode);
                return;
            }

            var text = NetUtil.readInputStreamToString(
                            inputStream, inputStream.available(),
                            {charset: 'UTF-8', replacement: '\ufffd'});
            callback.success(text);
        });
    };

    var writeStringToFile = function(fileObject, text, callback) {
        var outputStream = FileUtils.openSafeFileOutputStream(fileObject);
        var converter = _createUnicodeConverter();
        converter.charset = 'UTF-8';
        var inputStream = converter.convertToInputStream(text);

        NetUtil.asyncCopy(inputStream, outputStream, function(statusCode) {
            if (Components.isSuccessCode(statusCode)) {
                callback.success();
            } else {
                callback.fail(statusCode);
            }
        });
    };

    var getMostRecentWindow = windowMediator.getMostRecentWindow
                                            .bind(windowMediator);

    var exports = {
        createOpenFilePicker: createOpenFilePicker,
        createSaveFilePicker: createSaveFilePicker,
        readFileToString: readFileToString,
        writeStringToFile: writeStringToFile,
        getMostRecentWindow: getMostRecentWindow,
    }
    return exports;
})();

var Pref = function(branchRoot) {

    var supportsStringClass = Cc['@mozilla.org/supports-string;1'];
    var prefService = Cc['@mozilla.org/preferences-service;1']
                           .getService(Ci.nsIPrefService);

    var new_nsiSupportsString = function(data) {
        var string = supportsStringClass.createInstance(Ci.nsISupportsString);
        string.data = data;
        return string;
    };

    var branch = prefService.getBranch(branchRoot);

    var setString = function(key, value) {
        branch.setComplexValue(key, Ci.nsISupportsString,
                               new_nsiSupportsString(value));
    };
    var getString = function(key, defaultValue) {
        var value;
        try {
            value = branch.getComplexValue(key, Ci.nsISupportsString).data;
        } catch(error) {
            value = defaultValue || null;
        }
        return value;
    };

    var exports = {
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
    var stringbundle = document.getElementById('referrercontrol-strings');
    _ = function(name) stringbundle.getString(name);
};

var policyNames = null;
var initPolicyNames = function() {
    policyNames = [_('skip'), _('remove'),
                   _('sourceHost'), _('sourceDomain'),
                   _('targetHost'), _('targetDomain'), _('targetUrl')];
};

var buildRulesFromJsonRules = function(jsonRules) {
    var rules = [];
    for (var jsonRule of jsonRules) {

        var rule = {};
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
    var jsonRules = JSON.parse(pref.getString(PREF_NAME_RULES) || '[]');
    return buildRulesFromJsonRules(jsonRules);
})();

var createTreeItem = function(index, rule) {
    var treeitem = document.createElementNS(NS_XUL, 'treeitem');
    var treerow = document.createElementNS(NS_XUL, 'treerow');

    var indexCell = document.createElementNS(NS_XUL, 'treecell')
    indexCell.setAttribute('label', index);

    var sourceLabel = rule.source || '<' + _('any') + '>';
    var sourceCell = document.createElementNS(NS_XUL, 'treecell');
    sourceCell.setAttribute('label', sourceLabel);

    var targetLabel = rule.target || '<' + _('any') + '>';
    var targetCell = document.createElementNS(NS_XUL, 'treecell');
    targetCell.setAttribute('label', targetLabel);

    var isCustom = typeof(rule.value) === 'string';
    var valueLabel = isCustom ? rule.value : '<' + policyNames[rule.value] + '>';
    var valueCell = document.createElementNS(NS_XUL, 'treecell');
    valueCell.setAttribute('label', valueLabel);

    treerow.appendChild(indexCell);
    treerow.appendChild(sourceCell);
    treerow.appendChild(targetCell);
    treerow.appendChild(valueCell);
    treeitem.appendChild(treerow);
    return treeitem;
}

var updatePref = function() {
    var jsonRules = [];
    for (var rule of Rules) {
        var jsonRule = {};
        jsonRule.source = rule.source || undefined;
        jsonRule.target = rule.target || undefined;
        jsonRule.value = rule.value;
        jsonRule.comment = rule.comment || undefined;
        jsonRules.push(jsonRule);
    }

    var jsonText = JSON.stringify(jsonRules, null);
    pref.setString(PREF_NAME_RULES, jsonText);
};

var refreshUI = function() {
    // recreate the rule treeview
    var list = document.getElementById('rules-list');
    list.innerHTML = '';
    for (var i = 0; i < Rules.length; i += 1) {
        var treeitem = createTreeItem(i + 1, Rules[i]);
        list.appendChild(treeitem);
    }

    // disable some menuitems when no rules in the list
    var menuitems = document.querySelectorAll('menuitem.disable_when_empty');
    if (Rules.length == 0) {
        for (var menuitem of menuitems) {
            menuitem.setAttribute('disabled', true);
        }
    } else {
        for (var menuitem of menuitems) {
            menuitem.removeAttribute('disabled');
        }
    }
};

var openEditor = function(rule) {
    var result = {isAccept: false};
    openDialog(EDITOR_XUL, EDITOR_NAME, EDITOR_FEATURES, result, rule);
    return result.isAccept;
};

/* rule control */

var mergeRules = function(spareRules) {

    var getSameRule = function(spareRule) {
        // if "source" and "target" is same, treat as same rule
        for (var rule of Rules) {
            if (rule.source == spareRule.source &&
                    rule.target == spareRule.target) {
                return rule;
            }
        }
        return null;
    };

    for (var spareRule of spareRules) {
        var sameRule = getSameRule(spareRule);

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


    var parseRefControlRuleFile = function(text) {

        var createJsonRule = function(line) {
            var sepPos = line.indexOf('=');
            var siteString = line.slice(0, sepPos);
            var actionString = line.slice(sepPos + 1);

            var jsonRule = {};

            // convert target
            // RefControl use domain, partly match, but Referrer Control use
            // full match, so convert site string
            //     google.com
            // to regular expression
            //     '^https?://(?:[^/]+\\.)*google\\.com/.*$'
            // more detail see
            //     https://github.com/muzuiget/referrer_control/issues/23
            // also need to wrap with "/", var the rule parser treat it as
            // regular expression.
            var targetTpl = '/^https?://(?:[^/]+\\.)*${domain}/.*$/';
            var domain = siteString.replace(/\./g, '\\.');
            jsonRule.target = targetTpl.replace('${domain}', domain);

            // convert policy
            // Referrer Control handle third-party request globally,
            // so ignore the setting in RefControl
            var action;
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

            // add the line content to comment var user know this rule
            // is convert from RefControl rule file
            jsonRule.comment = 'RefControl: ' + line;

            return jsonRule;
        };

        var lines = text.split('\n')
                        .map(function(s) s.trim()) // remove spaces
                        .slice(1) // skip first line '[RefControl]'
                        .filter(function(s) s !== ''); // remove empty lines
        var jsonRules = lines.map(createJsonRule);
        return jsonRules;
    }

    var callback = {
        success: function(text) {
            var jsonRules;
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

            var spareRules;
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

    var jsonObject = {
        title: _('ruleFileTitle'),
        date: (new Date()).toLocaleFormat('%Y-%m-%d %H:%M:%S'),
        rules: Rules,
    };
    var jsonText = JSON.stringify(jsonObject, null, '    ');

    var callback = {
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

    var p = index - 1;
    var i = index;
    [Rules[p], Rules[i]] = [Rules[i], Rules[p]];

    updatePref();
    refreshUI();
};

var moveDownRule = function(index) {
    if (index === Rules.length - 1) {
        return;
    }

    var n = index + 1;
    var i = index;
    [Rules[n], Rules[i]] = [Rules[i], Rules[n]];

    updatePref();
    refreshUI();
};

var moveToTopRule = function(index) {
    if (index === 0) {
        return;
    }

    var rule = Rules.splice(index, 1)[0];
    Rules.unshift(rule);

    updatePref();
    refreshUI();
};

var moveToBottomRule = function(index) {
    if (index === Rules.length - 1) {
        return;
    }

    var rule = Rules.splice(index, 1)[0];
    Rules.push(rule);

    updatePref();
    refreshUI();
};

var newRule = function() {
    var rule = {
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
    var rule = Rules[index];

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
    var response = confirm(_('clearRulesWarnning'));
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
    var treeview = document.getElementById('rules-tree').view;
    var index = treeview.selection.currentIndex;
    if (index !== -1) {
        moveUpRule(index);
    }
};

var onMoveDownCommand = function() {
    var treeview = document.getElementById('rules-tree').view;
    var index = treeview.selection.currentIndex;
    if (index !== -1) {
        moveDownRule(index);
    }
};

var onMoveToTopCommand = function() {
    var treeview = document.getElementById('rules-tree').view;
    var index = treeview.selection.currentIndex;
    if (index !== -1) {
        moveToTopRule(index);
    }
};

var onMoveToBottomCommand = function() {
    var treeview = document.getElementById('rules-tree').view;
    var index = treeview.selection.currentIndex;
    if (index !== -1) {
        moveToBottomRule(index);
    }
};

// CRUD

var onNewCommand = function() {
    newRule();
};

var onEditCommand = function() {
    var treeview = document.getElementById('rules-tree').view;
    var index = treeview.selection.currentIndex;
    if (index !== -1) {
        editRule(index);
    }
};

var onRemoveCommand = function() {
    var treeview = document.getElementById('rules-tree').view;
    var index = treeview.selection.currentIndex;
    if (index !== -1) {
        removeRule(index);
    }
};

var onClearCommand = function() {
    clearRules();
};

/* others */

var onTreeDblclick = function(event) {
    var index = event.target._lastSelectedRow;
    if (index === undefined || index < 0) {
        return;
    }
    editRule(index);
};

var doHelp = function() {
    var helpUrl = 'https://github.com/muzuiget/referrer_control/wiki#rules';
    var browserWindow = Utils.getMostRecentWindow('navigator:browser');
    if (browserWindow) {
        var gBrowser = browserWindow.gBrowser;
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
