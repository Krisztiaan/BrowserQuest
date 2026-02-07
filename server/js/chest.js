
var Utils = require('./utils'),
    Item = require('./item'),
    Types = require("../../shared/js/gametypes");

var Chest = Item.extend({
    init: function(id, x, y) {
        this._super(id, Types.Entities.CHEST, x, y);
    },
    
    setItems: function(items) {
        this.items = items;
    },
    
    getRandomItem: function() {
        var nbItems = this.items.length,
            item = null;

        if(nbItems > 0) {
            item = this.items[Utils.random(nbItems)];
        }
        return item;
    }
});

module.exports = Chest;
