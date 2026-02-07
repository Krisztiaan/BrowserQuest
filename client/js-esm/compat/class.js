let initializing = false;
const fnTest = /xyz/.test(function () {
    return 'xyz';
})
    ? /\b_super\b/
    : /.*/;

function BaseClass() {}

BaseClass.extend = function extend(prop) {
    const _super = this.prototype;

    initializing = true;
    const prototype = new this();
    initializing = false;

    for (const name in prop) {
        if (typeof prop[name] === 'function' && typeof _super[name] === 'function' && fnTest.test(prop[name])) {
            prototype[name] = (function wrap(nameInner, fn) {
                return function wrapped() {
                    const tmp = this._super;
                    this._super = _super[nameInner];
                    const ret = fn.apply(this, arguments);
                    this._super = tmp;
                    return ret;
                };
            })(name, prop[name]);
        } else {
            prototype[name] = prop[name];
        }
    }

    function Class() {
        if (!initializing && this.init) {
            this.init.apply(this, arguments);
        }
    }

    Class.prototype = prototype;
    Class.prototype.constructor = Class;
    Class.extend = this.extend;

    return Class;
};

globalThis.Class = BaseClass;

export default BaseClass;
