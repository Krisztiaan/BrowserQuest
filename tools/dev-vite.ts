const serverProc = Bun.spawn({
  // Keep full-stack dev in sync with server edits without manual restarts.
  cmd: ["bun", "--watch", "server/js/main-esm.ts"],
  stdout: "inherit",
  stderr: "inherit",
});

const clientProc = Bun.spawn({
  cmd: ["bunx", "vite"],
  stdout: "inherit",
  stderr: "inherit",
});

const exitCode = await Promise.race([serverProc.exited, clientProc.exited]);
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
