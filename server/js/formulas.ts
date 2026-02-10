import Utils from './utils';

interface FormulasContract {
    dmg(weaponLevel: number, armorLevel: number): number;
    hp(armorLevel: number): number;
}

const Formulas: FormulasContract = {
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

export default Formulas;
