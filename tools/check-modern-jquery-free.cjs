#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

function listJsFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(entryPath);
    }
  }

  return files;
}

const checks = [
  {
    name: "jquery import",
    regex: /import\s+\$\s+from\s+['"]jquery['"]/,
  },
  {
    name: "jQuery selector call",
    regex: /\$\s*\(/,
  },
  {
    name: "jQuery static call",
    regex: /\$\s*\./,
  },
];

const root = process.cwd();
const jsEsmRoot = path.join(root, "client/js-esm");
const files = listJsFiles(jsEsmRoot).map((absPath) => path.relative(root, absPath));
const failures = [];

for (const relPath of files) {
  const absPath = path.join(root, relPath);
  const source = fs.readFileSync(absPath, "utf8");

  for (const check of checks) {
    if (check.regex.test(source)) {
      failures.push(`${relPath}: found ${check.name}`);
    }
  }
}

if (failures.length > 0) {
  console.error("modern-jquery-free-check: failed");
  failures.forEach((failure) => {
    console.error(`- ${failure}`);
  });
  process.exit(1);
}

console.log(`modern-jquery-free-check: ok (${files.length} files checked)`);
