const BISON = {
  encode(value) {
    return JSON.stringify(value);
  },
  decode(value) {
    return JSON.parse(value);
  },
};

export default BISON;
