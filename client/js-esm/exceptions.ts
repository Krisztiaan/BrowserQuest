class LootException extends Error {
    constructor(message: string) {
        super(message);
        this.name = "LootException";
    }
}

const Exceptions = { LootException };

export default Exceptions;
