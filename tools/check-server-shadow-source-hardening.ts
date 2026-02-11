import * as fs from 'node:fs';
import * as path from 'node:path';

const serverDir = path.join(process.cwd(), "server");

if (!fs.existsSync(serverDir)) {
  console.error("server-shadow-hardening-check: missing server directory");
  process.exit(1);
}

function listFilesRecursively(rootDir) {
  const files = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const currentDir = stack.pop();
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const relative = path.relative(rootDir, absolute).replace(/\\/g, "/");
      files.push(relative);
    }
  }
  return files.sort();
}

const allFiles = listFilesRecursively(serverDir);
const ctsFiles = allFiles.filter((name) => name.endsWith(".cts"));
const mixedOutputFiles = allFiles.filter((name) => name.endsWith(".js") || name.endsWith(".cjs"));

const nocheckFiles = [];

for (const ctsFile of ctsFiles) {
  const fullPath = path.join(serverDir, ctsFile);
  const source = fs.readFileSync(fullPath, "utf8");
  if (source.includes("@ts-nocheck")) {
    nocheckFiles.push(ctsFile);
  }
}

if (nocheckFiles.length || mixedOutputFiles.length) {
  if (nocheckFiles.length) {
    console.error("server-shadow-hardening-check: @ts-nocheck present in:");
    for (const file of nocheckFiles) {
      console.error(`  - ${file}`);
    }
  }

  if (mixedOutputFiles.length) {
    console.error("server-shadow-hardening-check: build outputs mixed into server source tree:");
    for (const file of mixedOutputFiles) {
      console.error(`  - ${file}`);
    }
    console.error("Keep emitted runtime artifacts out of source tree (use dist/** only).");
  }

  process.exit(1);
}

console.log(`server-shadow-hardening-check: ok (${ctsFiles.length} .cts sources, no mixed .js/.cjs artifacts)`);
