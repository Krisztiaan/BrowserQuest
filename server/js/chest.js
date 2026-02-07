
var Utils = require('./utils'),
    Item = require('./item'),
    Types = require("../../shared/js/gametypes");

class Chest extends Item {
    constructor(id, x, y) {
        super(id, Types.Entities.CHEST, x, y);
    }
    
    setItems(items) {
        this.items = items;
    }
    
    getRandomItem() {
        var nbItems = this.items.length,
            item = null;

        if(nbItems > 0) {
            item = this.items[Utils.random(nbItems)];
        }
        return item;
    }
}

module.exports = Chest;
