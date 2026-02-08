// AUTO-GENERATED from server/js/formulas.cts via bun run build:formulas.
// Do not edit server/js/formulas.js directly.

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Utils = require("./utils");
const Formulas = {
    dmg(weaponLevel, armorLevel) {
        const dealt = weaponLevel * Utils.randomInt(5, 10);
        const absorbed = armorLevel * Utils.randomInt(1, 3);
        const dmg = dealt - absorbed;
        if (dmg <= 0) {
            return Utils.randomInt(0, 3);
        }
        return dmg;
    },
    hp(armorLevel) {
        return 80 + (armorLevel - 1) * 30;
    },
};
module.exports = Formulas;
