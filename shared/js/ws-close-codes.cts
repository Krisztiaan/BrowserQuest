const CLOSE_CODES = {
    NORMAL: 1000,
    UNSUPPORTED_DATA: 1003,
    INVALID_PAYLOAD: 1007,
} as const;

module.exports = CLOSE_CODES;
