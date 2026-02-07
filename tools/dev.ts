const serverProc = Bun.spawn({
  cmd: ["bun", "server/js/main.js"],
  stdout: "inherit",
  stderr: "inherit",
});

const clientProc = Bun.spawn({
  cmd: ["bun", "tools/static-server.ts"],
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
