"use strict";

let EXPORTED_SYMBOLS = ['ToolbarManager'];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

const BROWSER_URI = 'chrome://browser/content/browser.xul';
const log = function() { dump(Array.slice(arguments).join(' ') + '\n'); }

let ToolbarManager = {

    /**
     * Remember the button position.
     * This function Modity from addon-sdk file lib/sdk/widget.js, and
     * function BrowserWindow.prototype._insertNodeInToolbar
     */
    layoutWidget: function(document, button, isFirstRun) {

        // Add to the customization palette
        let toolbox = document.getElementById('navigator-toolbox');
        toolbox.palette.appendChild(button);

        // Search for widget toolbar by reading toolbar's currentset attribute
        let container = null;
        let toolbars = document.getElementsByTagName('toolbar');
        let id = button.getAttribute('id');
        for (let i = 0; i < toolbars.length; i += 1) {
            let toolbar = toolbars[i];
            if (toolbar.getAttribute('currentset').indexOf(id) !== -1) {
                container = toolbar;
            }
        }

        // if widget isn't in any toolbar, default add it next to searchbar
        if (!container) {
            if (isFirstRun) {
                container = document.getElementById('nav-bar');
            } else {
                return;
            }
        }

        // Now retrieve a reference to the next toolbar item
        // by reading currentset attribute on the toolbar
        let nextNode = null;
        let currentSet = container.getAttribute('currentset');
        let ids = (currentSet === '__empty') ? [] : currentSet.split(',');
        let idx = ids.indexOf(id);
        if (idx !== -1) {
            for (let i = idx; i < ids.length; i += 1) {
                nextNode = document.getElementById(ids[i]);
                if (nextNode) {
                    break;
                }
            }
        }

        // Finally insert our widget in the right toolbar and in the right position
        container.insertItem(id, nextNode, null, false);

        // Update DOM in order to save position
        // in this toolbar. But only do this the first time we add it to the toolbar
        if (ids.indexOf(id) === -1) {
            container.setAttribute('currentset', container.currentSet);
            document.persist(container.id, 'currentset');
        }
    },

    addWidget: function(window, widget, isFirstRun) {
        if (window.location.href !== BROWSER_URI) {
            return;
        }

        let document = window.document;
        try {
            this.layoutWidget(document, widget, isFirstRun);
        } catch(error) {
            log(error);
        }
    },

    removeWidget: function(window, widgetId) {
        if (window.location.href !== BROWSER_URI) {
            return;
        }

        let document = window.document;
        try {
            let widget = document.getElementById(widgetId);
            widget.parentNode.removeChild(widget);
        } catch(error) {
            log(error);
        }
    }

};
