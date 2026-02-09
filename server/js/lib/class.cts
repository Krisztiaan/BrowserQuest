/* Simple JavaScript Inheritance
 * By John Resig http://ejohn.org/
 * MIT Licensed.
 */
// Inspired by base2 and Prototype
let initializing = false;
const fnTest = /.*/;

type ExtendableClass = {
    prototype: Record<string, unknown>;
    extend: (prop: Record<string, unknown>) => ExtendableClass;
    new (): Record<string, unknown>;
};

const BaseClass = function () {} as unknown as ExtendableClass;

BaseClass.extend = function (prop: Record<string, unknown>): ExtendableClass {
    const _super = this.prototype;

    initializing = true;
    const prototype = new this();
    initializing = false;

    for (const name in prop) {
        const propMember = prop[name];
        const superMember = _super[name];
        prototype[name] =
            typeof propMember === 'function' && typeof superMember === 'function' && fnTest.test(String(propMember))
                ? (function (memberName: string, fn: Function) {
                      return function (this: Record<string, unknown>) {
                          const tmp = this._super;
                          this._super = _super[memberName];
                          const ret = fn.apply(this, arguments as unknown as unknown[]);
                          this._super = tmp;
                          return ret;
                      };
                  })(name, propMember as unknown as Function)
                : propMember;
    }

    const Class = function (this: Record<string, unknown>) {
        if (!initializing && this.init) {
            (this.init as Function).apply(this, arguments as unknown as unknown[]);
        }
    } as unknown as ExtendableClass;

    Class.prototype = prototype;
    Class.constructor = Class;
    Class.extend = this.extend;

    return Class;
};

module.exports = {
    Class: BaseClass,
};
