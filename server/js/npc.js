
var Entity = require("./entity");

class Npc extends Entity {
    constructor(id, kind, x, y) {
        super(id, "npc", kind, x, y);
    }
}

module.exports = Npc;
