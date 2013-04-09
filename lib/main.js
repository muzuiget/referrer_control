const {Ci} = require('chrome');
const tabs = require('sdk/tabs');
const events = require('sdk/system/events');
const widgets = require('sdk/widget');
const ioFile = require('sdk/io/file');
const {data} = require('sdk/self');
const {createChanger} = require('./lib');

const RULE_PATH = '~/.referer-changer.rule.json';
const ENABLED_LOGO = data.url('logo.png');
const DISABLED_LOGO = data.url('logo-disabled.png');

let debugSkip = function(channel, reason) {
    referrer = channel.referrer ? channel.referrer.spec : '';
    let lines = ['',
                 'SKIP',
                 '   url: ' + channel.originalURI.spec,
                 '  keep: ' + referrer,
                 'reason: ' + reason]
    console.log(lines.join('\n    '));
};

let debugChange = function(channel, referrer) {
    let lines = ['',
                 'CHANGE',
                 '   url: ' + channel.originalURI.spec,
                 '  from: ' + channel.referrer.spec,
                 '    to: ' + referrer]
    console.log(lines.join('\n    '));
};

let ruleText;
try {
    ruleText = ioFile.read(RULE_PATH);
} catch (e) {
    console.error(e);
    ruleText = '[]';
}
let changer = createChanger(ruleText);

let widget = widgets.Widget({
    id: 'referrer-changer-link',
    label: 'Referrer Changer',
    contentURL: ENABLED_LOGO,
    onClick: function() {
        tabId = tabs.activeTab.id;
        enabled = changer.isEnabledTab(tabId);

        // toggle status
        if (enabled) {
            changer.disableTab(tabId);
            this.contentURL = DISABLED_LOGO;
        } else {
            changer.enableTab(tabId);
            this.contentURL = ENABLED_LOGO;
        }
    }
});

tabs.on('activate', function(tab) {
    if (changer.isEnabledTab(tab.id)) {
        widget.contentURL = ENABLED_LOGO;
    } else {
        widget.contentURL = DISABLED_LOGO;
    }
});

events.on('http-on-modify-request', function(event) {
    let channel = event.subject.QueryInterface(Ci.nsIHttpChannel);

    if (!channel.referrer) {
        //debugSkip(channel, 'empty referrer')
        return;
    }
    if (!changer.isFromEnabledTab(channel)) {
        //debugSkip(channel, 'disabled tab')
        return;
    }

    let referrer = changer.makeReferrer(channel);
    if (referrer === null) {
        //debugSkip(channel, 'by rule')
        return;
    }

    //debugChange(channel, referrer);
    channel.setRequestHeader('Referer', referrer, false);
}, true);

