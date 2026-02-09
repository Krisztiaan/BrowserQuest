const mapWatchProc = Bun.spawn({
  cmd: ["bun", "run", "map:watch"],
  stdout: "inherit",
  stderr: "inherit",
});

const serverProc = Bun.spawn({
  cmd: ["bun", "server/js/main-esm.ts"],
  stdout: "inherit",
  stderr: "inherit",
});

const clientProc = Bun.spawn({
  cmd: ["bunx", "vite"],
  stdout: "inherit",
  stderr: "inherit",
});

const exitCode = await Promise.race([mapWatchProc.exited, serverProc.exited, clientProc.exited]);

try {
  mapWatchProc.kill();
} catch (_) {
  // ignore
}
try {
  serverProc.kill();
} catch (_) {
  // ignore
}
try {
  clientProc.kill();
} catch (_) {
  // ignore
}

process.exit(typeof exitCode === "number" ? exitCode : 1);

export {};
