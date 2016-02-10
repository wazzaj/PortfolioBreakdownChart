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
        this._getPortfolioType();
        this._setStartDate();
        this._setEndDate();
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

    _setStartDate: function() {
        var app = this; 

        var d = Ext.Date.add(new Date(), Ext.Date.DAY, -7);
        app.startDate = Ext.Date.clearTime(d);

        var startDateField = Ext.create('Ext.Container', {
            items: [{
                itemId: 'start-Date',
                xtype: 'rallydatefield',
                fieldLabel: 'Start Date',
                labelAlign: 'right',
                listeners: {
                    select: app._loadData,
                    scope: app
                    },                   
                maxValue: Ext.Date.add(new Date(), Ext.Date.DAY, -1),
                value: app.startDate
            }],
            renderTo: Ext.getBody().dom
        });

        app.down('#filter-Box').add(startDateField);
    },

    _setEndDate: function() {
        var app = this;

        app.endDate = Ext.Date.add(new Date());

        var endDateField = Ext.create('Ext.Container', {
            items: [{
                itemId: 'end-Date',
                xtype: 'rallydatefield',
                fieldLabel: 'End Date',                
                labelAlign: 'right',
                listeners: {
                    select: app._loadData,
                    scope: app                    
                    },    
                maxValue: Ext.Date.add(new Date()),
                value: app.endDate
                }],
            renderTo: Ext.getBody().dom
        });

        app.down('#filter-Box').add(endDateField);
    },

    _loadData: function() {
        var app = this;

        app.piType = app.down('#type-Filter').getRecord().get('Name');
        app.startDate = app.down('#start-Date').getValue();
        app.endDate = app.down('#end-Date').getValue();

        var piFilter = Ext.create('Rally.data.wsapi.Filter', {
            property: 'PortfolioItemType.Name',
            operator: '=',
            value: app.piType
        });

        if(app.itemStore) {
            app.itemStore.setFilter(piFilter);
            app.itemStore.load();
        } else {
            app.itemStore = Ext.create('Rally.data.wsapi.Store', {
                model: 'Portfolio Item',
                autoLoad: true,
                filters: piFilter,
                listeners: {
                    load: function(myStore, myData, success) {
                        app._processPortfolioItems();
                        app._drawPieChart();
                    },
                    scope: app    
                },
                fetch: ['FormattedID','ObjectID', 'Name', 'PortfolioItemType']
            });
        }      
    },

    _processPortfolioItems: function() {
        var app = this;

        app._createArrayStore();

        app.itemStore.each(function(record) {
            var item = record.get('ObjectID');
            var id = record.get('FormattedID');
            var name = record.get('Name');

            app._getPointsDifference(item,app.startDate).then({
                scope: app,
                success: function(startPoints) {
                    app._getPointsDifference(item,app.endDate).then({
                        scope: app,
                        success: function(endPoints) {
                            var totalPoints = endPoints - startPoints;
                            app.newPointsStore.add({
                                FormattedID:id, 
                                Name:name, 
                                Start: startPoints, 
                                End: endPoints, 
                                Points:totalPoints});
                        },
                        failure: function(error) {
//                            console.log("Error 2");
                        }
                    });
                },
                failure: function(error) {
//                    console.log("Error");
                }    
            });            
        },app);
    },

    _getPointsDifference: function(objid, uDate) {
        var app = this;

        var deferred = Ext.create('Deft.Deferred');

        var uStore = Ext.create('Rally.data.lookback.SnapshotStore', {
            autoLoad: true,
            listeners: {
                scope: app,
                load: function(uStore, uData, success) {
                    uStore.each(function(record) {
                        var points = record.get('AcceptedLeafStoryPlanEstimateTotal'); 
                        deferred.resolve(points);
                    },app);
                }
            },
            fetch: ['Name', 'AcceptedLeafStoryPlanEstimateTotal'],
            filters: [
                {
                    property: 'ObjectID',
                    operator: '=',
                    value: objid
                },
                {
                    property: '__At',
                    value: uDate
                }
            ]
        });

        return deferred.promise;
    },

    _createArrayStore: function() {
        var app = this;

        if (app.newPointsStore) {
            app.newPointsStore.removeAll();
        } else {
            app.newPointsStore = new Ext.data.ArrayStore({
                fields: [
                    'FormattedID',
                    'Name',
                    'Start',
                    'End',
                    'Points'
                ]
            });
        }    
    },

    _createPointsGrid: function() {
        var app = this;

        if(!app.pointsGrid) {
            app.pointsGrid = new Ext.grid.Panel({
                store: app.newPointsStore,
                columns: [
                    {text: 'ID',        dataIndex: 'FormattedID'},       
                    {text: 'Name',      dataIndex: 'Name',   flex:1},
                    {text: 'Start',     dataIndex: 'Start'},
                    {text: 'End',       dataIndex: 'End'},
                    {text: 'Points',    dataIndex: 'Points'}
                ],
                renderTo: Ext.getBody()
                });
            app.add(app.pointsGrid);
        }
    },

    _drawPieChart: function() {
        var app = this;

        if(!app.pieChart) {
            app.pieChart = new Ext.chart.Chart({
                width: 600,
                height: 600,
                animate: true,
//                autoSize: true,
//                autoScroll: true,
                store: app.newPointsStore,
                renderTo: Ext.getBody(),
                shadow: true,
                legend: {
                    position: 'right'
                },
                insetPadding: 25,
                theme: 'Base:gradients',
                series: [{
                    type: 'pie',
                    field: 'Points',
                    showInLegend: true,
                    tips: {
                        trackMouse: true,
                        width: 300,
                        height: 28,
                        renderer: function(storeItem, item) {
                            app.setTitle(storeItem.get('Name') + ': ' + storeItem.get('Points'));
                        }
                    },
                    highlight: {
                        segment: {
                            margin: 20
                        }
                    },
                    label: {
                        field: 'Name',
                        display: 'none'
                    },
                    animate: true
                }]
            });
            app.add(app.pieChart);
        }    
    }    
});