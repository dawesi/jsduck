/**
 * Handles the Tab bar functionality and tracking of Tabs.
 * This is a custom implementation and has nothing to do with regular Ext tabs.
 */
Ext.define('Docs.view.Tabs', {
    extend: 'Ext.container.Container',
    alias: 'widget.doctabs',
    id: 'doctabs',

    componentCls: 'doctabs',

    minTabWidth: 80,
    maxTabWidth: 160,

    tabs: [],
    tabsInBar: [],
    tabCache: {},

    staticTabs: [
        { cls: 'index',    href: '#' },
        { cls: 'classes',  href: '#!/api' },
        { cls: 'guides',   href: '#!/guide' },
        { cls: 'videos',   href: '#!/video' },
        { cls: 'examples', href: '#!/example' }
    ],

    initComponent: function() {
        this.tpl = Ext.create('Ext.XTemplate',
            '<tpl for=".">',
                '<div class="doctab overview {cls}{active}">',
                    '<div class="l"></div>',
                    '<div class="m"><a class="tabUrl" href="{href}">&nbsp;</a></div>',
                    '<div class="r"></div>',
                '</div>',
            '</tpl>',
            '<div style="float: left; width: 8px">&nbsp;</div>',
            '<div id="tabOverflow" style="visibility: hidden"></div>'
        );

        this.html = this.tpl.applyTemplate(this.staticTabs);

        this.tabTpl = Ext.create('Ext.XTemplate',
            '<div class="doctab',
                    '{[values.active ? (" active") : ""]}',
                '" style="',
                    '{[values.width ? ("width: " + values.width + "px;") : ""]}',
                    '{[values.visible ? "" : "visibility: hidden;"]}">',
                '<div class="l"></div>',
                '<div class="m">',
                    '<span class="icn {iconCls}">&nbsp;</span>',
                    '<a class="tabUrl" href="{href}">{text}</a>',
                '</div>',
            '<div class="r"><a class="close" href="#">&nbsp;</a></div>',
            '</div>'
        );

        this.callParent();
    },

    listeners: {
        afterrender: function() {
            this.createOverflow();
        }
    },

    /**
     * Adds a new tab
     *
     * @param {Object} tab
     * @param {String} tab.href URL of the resource
     * @param {String} tab.text Text to be used on the tab
     * @param {String} tab.iconCls CSS class to be used as the icon
     * @param {Object} opts Options object:
     * @param {Boolean} opts.animate True to animate the addition
     * @param {Boolean} opts.activate True to activate the tab
     */
    addTab: function(tab, opts) {

        // console.log("Adding tab", tab, opts)

        this.tabCache[tab.href] = tab;

        if (!this.hasTab(tab.href)) {

            this.tabs.push(tab.href);

            if (this.roomForNewTab()) {
                this.addTabToBar(tab, opts);
            }
            this.addTabToOverflow(tab, opts);
        }
        this.activateTab(tab.href);

        if (this.tabs.length > this.maxTabsInBar()) {
            Ext.get('tabOverflow').show();
        }
    },

    /**
     * Removes a tab. If the tab to be closed is currently active, activate a neighboring tab.
     *
     * @param {String} url URL of the tab to remove
     */
    removeTab: function(url) {

        if (!this.hasTab(url)) return false;

        var idx = Ext.Array.indexOf(this.tabs, url);
        if (idx !== false) {
            Ext.Array.erase(this.tabs, idx, 1);
        }
        var idx = Ext.Array.indexOf(this.tabsInBar, url);
        if (idx !== false) {
            Ext.Array.erase(this.tabsInBar, idx, 1);
        }
        if (this.tabs[this.tabsInBar.length]) {
            this.tabsInBar.push(this.tabs[this.tabsInBar.length]);
        }

        if (this.activeTab == url) {
            if (this.tabs.length === 0) {
                Docs.App.getController(this.getControllerName(url)).loadIndex();
            }
            else {
                if (idx === this.tabs.length) {
                    idx -= 1;
                }
                this.activateTab(this.tabs[idx]);
                Docs.History.push(this.tabs[idx]);
            }
        }

        // console.log(this.tabsInBar.length, this.tabs.length)
        if (this.tabs.length >= this.maxTabsInBar()) {
            this.refresh();
        } else {
            this.removeTabFromBar(url);
        }
    },

    /**
     * Activates a tab
     *
     * @param {String} url URL of tab
     */
    activateTab: function(url) {

        // console.log("Activating", url);

        this.activeTab = url;

        if (!this.inTabs(url)) {
            this.swapLastTabWith(url);
        }

        Ext.Array.each(Ext.query('.doctab a[class=tabUrl]'), function(d) {
            Ext.get(d).up('.doctab').removeCls(['active', 'highlight']);
        });

        var activeTab = Ext.query('.doctab a[href="' + url + '"]')[0];
        if (activeTab) {
            var docTab = Ext.get(activeTab).up('.doctab');
            docTab.addCls('active');
        }

        this.highlightOverviewTab(url);
    },

    /**
     *  Re-renders tabs and overflow. Useful for window resize event.
     */
    refresh: function() {

        var html = this.tpl.applyTemplate(this.staticTabs)

        var len = this.maxTabsInBar() < this.tabs.length ? this.maxTabsInBar() : this.tabs.length;
        this.tabsInBar = this.tabs.slice(0, len);

        // console.log("Total tabs:", this.tabs.length, "Max tabs:", this.maxTabsInBar(), "Tab bar width:", this.tabBarWidth(), "Tabs in bar:", this.tabsInBar.length, "Tab width:", tw)

        for (var i=0; i< len; i++) {

            var tab = this.tabCache[this.tabs[i]];

            var tabData = Ext.apply(tab, {
                visible: true,
                active: this.activeTab === tab.href,
                width: this.tabWidth()
            });

            html += this.tabTpl.applyTemplate(tabData);
        }

        this.el.dom.innerHTML = html;

        // console.log(this.activeTab, this.tabs[len-1])
        if (this.activeTab != this.tabs[len-1]) {
            this.activateTab(this.activeTab);
            Docs.History.push(this.activeTab);
        }

        this.highlightOverviewTab(this.activeTab);
        this.createOverflow();
    },

    // Private methods

    tabData: function() {
        return Ext.Array.map(this.tabs, function(t){
            return this.tabCache[t];
        }, this);
    },

    /**
     * @private
     * Determines if the tab bar has room for a new tab.
     * @return {Boolean} True if tab bar has room for a new tab
     */
    roomForNewTab: function() {
        return this.tabsInBar.length < this.maxTabsInBar();
    },

    /**
     * @private
     * @return {Boolean} True if we are already tracking a tab with the given URL
     */
    hasTab: function(url) {
        return Ext.Array.contains(this.tabs, url);
    },

    /**
     * @private
     * Adds a tab to the tab bar
     */
    addTabToBar: function(tab, opts) {

        // console.log("Adding tab to bar", tab.href)

        this.tabsInBar.push(tab.href);

        var docTab = Ext.get(this.tabTpl.append(this.el.dom, tab));

        if (opts.animate) {
            // Effect to 'slide' the tab out when it is created.
            docTab.setStyle('width', '10px');
            docTab.setStyle({ visibility: 'visible' });
            docTab.animate({
                to: { width: this.tabWidth() }
            });
        }
        else {
            docTab.setStyle({ visibility: 'visible' });
        }

        this.resizeTabs();
    },

    /**
     * @private
     * @return {Boolean} true if the tab is in the tab bar
     */
    inTabBar: function(url) {
        return Ext.Array.contains(this.tabsInBar, url);
    },

    /**
     * @private
     * @return {Boolean} true if the tab is in the tab bar or static tabs
     */
    inTabs: function(url) {
        var urls = Ext.Array.pluck(this.staticTabs, 'href').concat(this.tabsInBar);
        return Ext.Array.contains(urls, url);
    },

    /**
     * @private
     */
    removeTabFromBar: function(url) {

        var docTab = this.getTabEl(url);

        docTab.dom.removed = true;
        docTab.animate({
            to: { top: 30 }
        }).animate({
            to: { width: 10 },
            listeners: {
                afteranimate: function() {
                    docTab.remove();
                    this.shouldResize = true;
                },
                scope: this
            }
        });
    },

    /**
     * @private
     * Adds a tab to the overflow list
     */
    addTabToOverflow: function(tab, opts) {

        var inTabBar = this.inTabBar(tab.href);
        var idx = Ext.Array.indexOf(this.tabs, tab.href);

        if (this.tabs.length > this.tabsInBar.length && idx == this.maxTabsInBar()) {
            // Add 'overflow' class to last visible tab in overflow dropdown
            var prevMenuItem = Ext.ComponentQuery.query('#tabOverflowMenu menuitem[href=' + this.tabs[idx-1] + ']');
            Ext.Array.each(prevMenuItem, function(item) {
                item.addCls('overflow');
            });
        }

        Ext.getCmp('tabOverflowMenu').add({
            text: tab.text,
            iconCls: tab.iconCls,
            origIcon: tab.iconCls,
            href: tab.href,
            cls: 'x-menu-item-checked' + (inTabBar ? '' : ' overflow')
        });
    },

    /**
     * @private
     * Swaps the last tab with the given tab currently in the overflow list
     */
    swapLastTabWith: function(url) {
        var lastTab = this.getTabEl(this.tabsInBar[this.tabsInBar.length - 1]);
        if (lastTab) {
            var newTab = this.tabTpl.append(document.body, this.tabCache[url]);
            lastTab.dom.parentNode.replaceChild(newTab, lastTab.dom);
            this.tabsInBar[this.tabsInBar.length - 1] = url;
            Ext.get(newTab).setStyle({ visibility: 'visible', width: String(this.tabWidth()) + 'px' });
        }
    },

    /**
     * @private
     */
    highlightOverviewTab: function(url) {
        var overviewTab = Ext.query('.doctab.' + this.getControllerName(url).toLowerCase());
        if (overviewTab && overviewTab[0]) {
            Ext.get(overviewTab[0]).addCls('highlight');
        }
    },

    /**
     * @private
     * @return {Number} Maximum number of tabs we can fit in the tab bar
     */
    maxTabsInBar: function() {
        return Math.floor(this.tabBarWidth() / this.minTabWidth);
    },

    /**
     * @private
     * @return {Number} Width of a tab in the tab bar
     */
    tabWidth: function() {
        var width = Math.floor(this.tabBarWidth() / this.tabsInBar.length) + 6;

        if (width > this.maxTabWidth) {
            return this.maxTabWidth;
        }
        else if (width < this.minTabWidth) {
            return this.minTabWidth;
        }
        else {
            return width;
        }
    },

    /**
     * @private
     * @return {Number} Width of the tab bar (not including the static tabs)
     */
    tabBarWidth: function() {
        return this.getWidth() - 265;
    },

    /**
     * @private
     * Resize tabs in the tab bar
     */
    resizeTabs: function() {
        this.shouldResize = false;
        Ext.Array.each(Ext.query('.doctab'), function(t){
            var docTab = Ext.get(t);
            if (!docTab.dom.removed && !docTab.hasCls('overview')) {
                docTab.animate({
                    to: { width: this.tabWidth() }
                });
            }
        }, this);
    },

    getTabEl: function(url) {
        var doctab = Ext.query('.doctab a[href="' + url + '"]');
        if (doctab && doctab[0]) {
            return Ext.get(doctab[0]).up('.doctab');
        }
    },

    /**
     * @private
     * Creates the overflow button and add items
     */
    createOverflow: function() {

        if (this.overflowButton) {
            this.overflowButton.destroy();
        }

        this.overflowButton = Ext.create('Ext.button.Button', {
            baseCls: null,
            renderTo: 'tabOverflow',
            menu: {
                id: 'tabOverflowMenu',
                plain: true,
                items: []
            }
        });

        Ext.Array.each(this.tabs, function(tab) {
            this.addTabToOverflow(this.tabCache[tab]);
        }, this);

        if (this.tabs.length > this.maxTabsInBar()) {
            Ext.get('tabOverflow').show();
        }
    },

    /**
     * @private
     * Determines controller name from a URL
     */
    getControllerName: function(url) {
        if (/#!?\/api/.test(url)) {
            return 'Classes';
        }
        else if (/#!?\/guide/.test(url)) {
            return 'Guides';
        }
        else if (/#!?\/video/.test(url)) {
            return 'Videos';
        }
        else if (/#!?\/example/.test(url)) {
            return 'Examples';
        }
        else {
            return 'Index';
        }
    }
});
