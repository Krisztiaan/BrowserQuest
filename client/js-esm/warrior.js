
import Player from 'player';
import Types from 'compat/gametypes';

var Warrior = Player.extend({
    init: function(id, name) {
        this._super(id, name, Types.Entities.WARRIOR);
    },
});

export default Warrior;
