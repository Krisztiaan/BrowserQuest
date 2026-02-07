
var Messages = require('./message'),
    Utils = require('./utils');

class Entity {
    constructor(id, type, kind, x, y) {
        this.id = Number.parseInt(id, 10);
        this.type = type;
        this.kind = kind;
        this.x = x;
        this.y = y;
    }
    
    destroy() {

    }
    
    _getBaseState() {
        return [
            this.id,
            this.kind,
            this.x,
            this.y
        ];
    }
    
    getState() {
        return this._getBaseState();
    }
    
    spawn() {
        return new Messages.Spawn(this);
    }
    
    despawn() {
        return new Messages.Despawn(this.id);
    }
    
    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }
    
    getPositionNextTo(entity) {
        /** @type {{x: number, y: number} | null} */
        var pos = null;
        if(entity) {
            pos = { x: entity.x, y: entity.y };
            // This is a quick & dirty way to give mobs a random position
            // close to another entity.
            var r = Utils.random(4);

            if(r === 0)
                pos.y -= 1;
            if(r === 1)
                pos.y += 1;
            if(r === 2)
                pos.x -= 1;
            if(r === 3)
                pos.x += 1;
        }
        return pos;
    }
}

module.exports = Entity;
