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

        var piTypeField = {
            xtype: 'rallyportfolioitemtypecombobox',
            itemId: 'type-Filter',
            fieldLabel: 'Item Type',
            labelAlign: 'right',
            renderTo: Ext.getBody().dom,
            listeners: {
                select: function(combobox, records) {
                    this.piType = this.down('#type-Filter').getRecord().get('Name');
                    this._loadData();
                },
                scope: this
            }
        };

        this.down('#filter-Box').add(piTypeField);
    },

    _setStartDate: function() {
        var d = Ext.Date.add(new Date(), Ext.Date.DAY, -7);
        this.startDate = Ext.Date.clearTime(d);

        var startDateField = Ext.create('Ext.Container', {
            items: [{
                xtype: 'rallydatefield',
                fieldLabel: 'Start Date',
                labelAlign: 'right',
                listeners: {
                    select: function(field, value) {
                        this.startDate = value;
                        this._loadData();
                    },                    
                    scope: this
                },    
                maxValue: Ext.Date.add(new Date(), Ext.Date.DAY, -1),
                value: this.startDate
            }],
            renderTo: Ext.getBody().dom
        });

        this.down('#filter-Box').add(startDateField);
    },

    _setEndDate: function() {
        this.endDate = Ext.Date.add(new Date());

        var endDateField = Ext.create('Ext.Container', {
            items: [{
                xtype: 'rallydatefield',
                fieldLabel: 'End Date',                
                labelAlign: 'right',
                listeners: {
                    select: function(field, value) {
                        this.endDate = value;
                        this._loadData();
                    },                    
                    scope: this
                    },    
                maxValue: Ext.Date.add(new Date()),
                value: this.endDate
                }],
            renderTo: Ext.getBody().dom
        });

//        this.pulldownContainer.add(endDateField);
        this.down('#filter-Box').add(endDateField);

    },

    _loadData: function() {
        var piFilter = Ext.create('Rally.data.wsapi.Filter', {
            property: 'PortfolioItemType.Name',
            operator: '=',
            value: this.piType
        });

        if(this.itemStore) {
            this.itemStore.setFilter(piFilter);
            this.itemStore.load();
        } else {
            this.itemStore = Ext.create('Rally.data.wsapi.Store', {
                model: 'Portfolio Item',
                autoLoad: true,
                filters: piFilter,
                listeners: {
                    load: function(myStore, myData, success) {
                        this._processPortfolioItems();
                        this._drawPieChart();
                    },
                    scope: this    
                },
                fetch: ['FormattedID','ObjectID', 'Name', 'PortfolioItemType']
            });
        }      
    },

    _processPortfolioItems: function() {

        this._createArrayStore();

        this.itemStore.each(function(record) {
            var item = record.get('ObjectID');
            var id = record.get('FormattedID');
            var name = record.get('Name');

            this._getPointsDifference(item,this.startDate).then({
                scope: this,
                success: function(startPoints) {
                    this._getPointsDifference(item,this.endDate).then({
                        scope: this,
                        success: function(endPoints) {
                            var totalPoints = endPoints - startPoints;
                            this.newPointsStore.add({
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
        },this);
    },

    _getPointsDifference: function(objid, uDate) {
        var deferred = Ext.create('Deft.Deferred');

        var uStore = Ext.create('Rally.data.lookback.SnapshotStore', {
            autoLoad: true,
            listeners: {
                scope: this,
                load: function(uStore, uData, success) {
                    uStore.each(function(record) {
                        var points = record.get('AcceptedLeafStoryPlanEstimateTotal'); 
                        deferred.resolve(points);
                    },this);
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

        if (this.newPointsStore) {
            this.newPointsStore.removeAll();
        } else {
            this.newPointsStore = new Ext.data.ArrayStore({
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

        if(!this.pointsGrid) {
            this.pointsGrid = new Ext.grid.Panel({
                store: this.newPointsStore,
                columns: [
                    {text: 'ID',        dataIndex: 'FormattedID'},       
                    {text: 'Name',      dataIndex: 'Name',   flex:1},
                    {text: 'Start',     dataIndex: 'Start'},
                    {text: 'End',       dataIndex: 'End'},
                    {text: 'Points',    dataIndex: 'Points'}
                ],
//                title: 'Portfolio Items - Points Completed',
                renderTo: Ext.getBody()
                });
            this.add(this.pointsGrid);
        }
    },

    _drawPieChart: function() {

        if(!this.pieChart) {
            this.pieChart = new Ext.chart.Chart({
                width: 600,
                height: 600,
                animate: true,
//                autoSize: true,
//                autoScroll: true,
                store: this.newPointsStore,
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
                            this.setTitle(storeItem.get('Name') + ': ' + storeItem.get('Points'));
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
            this.add(this.pieChart);
        }    
    }    
});