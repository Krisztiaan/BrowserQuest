#!/usr/bin/env node

const command = process.argv[2] || "legacy-command";

console.error(
  `Legacy runtime command "${command}" has been retired.\n` +
    `Use modern commands: "bun run verify", "bun run build:vite", and "bun run test:modern-browser".`
);
process.exit(1);
