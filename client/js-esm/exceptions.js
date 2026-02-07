
import Class from 'compat/class';

var Exceptions = {
    
    LootException: Class.extend({
        init: function(message) {
            this.message = message;
        }
    })
};

export default Exceptions;
