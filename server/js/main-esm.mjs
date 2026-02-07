import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Compatibility bridge: keep the existing CJS boot path intact while enabling
// an explicit ESM entrypoint command.
require("./main.js");
