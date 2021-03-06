Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    items: [
        {
        xtype: 'container',
        itemId: 'filter-Box', 
        layout: {
            type: 'hbox',
            align: 'stretch'
            }
        }
    ],

    launch: function() {
        var app = this;

        if (app.getSetting("type") === "")  {
            app._getPortfolioType();
        } else {
            app.piType = app.getSetting("type");
        }

        app.includeStates = app.getSetting("includeStates");

        if (app.getSetting("type") !== "")  {
            app._loadData();
        } 
    },

    config: {

    defaultSettings : {
        type : "",
        includeStates : "Deliver",
        gridDisplay : true
        }
    },

    getSettingsFields: function() {
        var values = [
            {
                name: 'type',
                xtype: 'rallytextfield',
                label : "Portfolio Type e.g. Feature"
            },
            {   name: 'includeStates',
                xtype: 'rallytextfield',
                label: "Specify state to be included from count e.g. Deliver"
            },
            {
                name: 'gridDisplay',
                xtype: 'rallycheckboxfield',
                label : "Display Grid"
            }
        ];

        return values;
    },

    _getPortfolioType: function() {
        var app = this;

        var piTypeField = {
            xtype: 'rallyportfolioitemtypecombobox',
            itemId: 'type-Filter',
            fieldLabel: 'Item Type',
            labelAlign: 'right',
            renderTo: Ext.getBody().dom,
            listeners: {
                select: app._loadData,
                scope: app
                }                
            };

        app.down('#filter-Box').add(piTypeField);
    },


    _loadData: function() {
        var app = this;

        if (app.getSetting("type") === "")  { 
            app.piType = app.down('#type-Filter').getRecord().get('Name');
        }

        var piFilter = Ext.create('Rally.data.wsapi.Filter', {
            property: 'PortfolioItemType.Name',
            operator: '=',
            value: app.piType
        });

        app.itemStore = Ext.create('Rally.data.wsapi.Store', {
            model: 'Portfolio Item',
            autoLoad: true,
            filters: piFilter,
            limit: Infinity,
            listeners: {
                load: function(myStore, myData, success) {
                    app._processPortfolioItems();
                    app._drawPieChart();

                    if (app.getSetting("gridDisplay") === true)  {
                        app._createPointsGrid();
                    }
                },
                scope: app    
            },
            fetch: ['FormattedID','ObjectID', 'Name', 'PortfolioItemType']
        });
    },

    _processPortfolioItems: function() {
        var app = this;

        app._createArrayStore();

        app.itemStore.each(function(record) {
            var item = record.get('ObjectID');
            var id = record.get('FormattedID');
            var name = record.get('Name');

            app._getNextLevelItemCount(id).then({
                scope: app,
                success: function(itemCount) {
                    if (itemCount > 0) {
                        app.pointsStore.add({
                            FormattedID:id, 
                            Name:name, 
                            Count:itemCount});
                    }
                },
                failure: function(error) {
                    console.log("Error");
                }    
            });            
        },app);
    },

    _getNextLevelItemCount: function(id) {
        var app = this;
        var deferred = Ext.create('Deft.Deferred');

        var myFilter = Ext.create('Rally.data.wsapi.Filter', {
            property: 'Parent.FormattedID',
            operator: '=',
            value: id
        });

        var andTogetherFilter = myFilter.and(Ext.create('Rally.data.wsapi.Filter', {
            property: 'kanbanState.Name',
            operator: '=',
            value: app.includeStates
        }));
        console.log(andTogetherFilter.toString());

        app.itemStore = Ext.create('Rally.data.wsapi.Store', {
            model: 'Portfolio Item',
            autoLoad: true,
            filters: andTogetherFilter,
            limit: 1,
            listeners: {
                load: function(myStore, myData, success) {
                    deferred.resolve(myStore.getCount());
                },
                scope: app    
            },
            fetch: ['FormattedID','ObjectID', 'Name']
        });
        return deferred.promise;
    },

    _createArrayStore: function() {
        var app = this;

        if (app.pointsStore) {
            app.pointsStore.removeAll();
        } else {
            app.pointsStore = new Ext.data.ArrayStore({
                fields: [
                    'FormattedID',
                    'Name',
                    'Count'
                ]
            });
        }    
    },

    _createPointsGrid: function() {
        var app = this;

        if(!app.pointsGrid) {
            app.pointsGrid = new Ext.grid.Panel({
                store: app.pointsStore,
                width: Ext.getBody().getViewSize().width,
                columns: [
                    {text: 'ID',        dataIndex: 'FormattedID'},       
                    {text: 'Name',      dataIndex: 'Name',   flex:1},
                    {text: 'Count',    dataIndex: 'Count'}
                ],
                renderTo: Ext.getBody()
                });

            Ext.EventManager.onWindowResize(function () {
                var width = Ext.getBody().getViewSize().width;
                app.pointsGrid.setWidth(width);
            });
            
            app.add(app.pointsGrid);
        }
    },

    _drawPieChart: function() {
        var app = this;

        if(!app.pieChart) {
            app.pieChart = new Ext.chart.Chart({
                width: Ext.getBody().getViewSize().width,
                height: Ext.getBody().getViewSize().height - 20,
                animate: true,
                store: app.pointsStore,
                renderTo: Ext.getBody(),
                shadow: true,
                legend: {
                    position: 'right'
                },
                insetPadding: 25,
                theme: 'Base:gradients',
                series: [{
                    type: 'pie',
                    field: 'Count',
                    showInLegend: true,
                    tips: {
                        trackMouse: true,
                        width: 500,
                        height: 29,
                        bodyStyle: {background: 'white'},
                        renderer: function(storeItem, item) {
                            var total = 0;
                            app.pointsStore.each(function(rec) {
                                total += rec.get('Count');
                            });
                            this.setTitle(storeItem.get('Name') + ': ' + storeItem.get('Count') + ', ' + Math.round(storeItem.get('Count')/total*100) + '%');
                        }
                    },
                    highlight: {
                        segment: {
                            margin: 20
                        }
                    },
                    label: {
                        field: 'Name'
//                        display: 'rotate',
//                        font: '8px Arial'
                    },
                    animate: true
                }]
            });

            Ext.EventManager.onWindowResize(function () {
                var width = Ext.getBody().getViewSize().width;
                var height = Ext.getBody().getViewSize().height - 20;
                app.pieChart.setSize(width, height);
            });

            app.add(app.pieChart);
        }
    } 
});