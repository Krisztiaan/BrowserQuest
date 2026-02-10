import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

function fail(message: string): never {
  process.stderr.write(`node22-run: ${message}\n`);
  process.exit(1);
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes).trim();
}

function runCapture(cmd: string[]): { code: number | null; stdout: string; stderr: string } {
  const result = Bun.spawnSync({
    cmd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    code: result.exitCode,
    stdout: decode(result.stdout),
    stderr: decode(result.stderr),
  };
}

function resolveNode22Bin(): string {
  const systemNode = Bun.which("node");
  if (systemNode) {
    const majorProbe = runCapture([systemNode, "-p", "process.versions.node.split('.')[0]"]);
    if (majorProbe.code === 0 && majorProbe.stdout === "22") {
      return systemNode;
    }
  }

  const npmBin = Bun.which("npm");
  if (!npmBin) {
    fail("npm is required to provision Node 22 when system node is not v22");
  }

  const npmProbe = runCapture([
    npmBin,
    "exec",
    "--yes",
    "--package=node@22",
    "--",
    "node",
    "-p",
    "process.execPath",
  ]);

  if (npmProbe.code !== 0 || npmProbe.stdout.length === 0) {
    fail(`failed to resolve Node 22 executable via npm exec (${npmProbe.stderr || "unknown error"})`);
  }

  return npmProbe.stdout;
}

const command = Bun.argv.slice(2);
if (command.length === 0) {
  process.stderr.write("Usage: bun tools/node22-run.ts <command> [args...]\n");
  process.stderr.write("Example: bun tools/node22-run.ts bun run verify:modern\n");
  process.exit(1);
}

const node22Bin = resolveNode22Bin();
const shimDir = mkdtempSync(path.join(tmpdir(), "bq-node22-"));
const nodeShimPath = path.join(shimDir, "node");

try {
  symlinkSync(node22Bin, nodeShimPath);
} catch (error) {
  rmSync(shimDir, { recursive: true, force: true });
  fail(`unable to create node shim (${error instanceof Error ? error.message : String(error)})`);
}

try {
  const proc = Bun.spawn({
    cmd: command,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      PATH: `${shimDir}${path.delimiter}${process.env.PATH ?? ""}`,
    },
  });

  const exitCode = await proc.exited;
  process.exit(typeof exitCode === "number" ? exitCode : 1);
} finally {
  rmSync(shimDir, { recursive: true, force: true });
}
