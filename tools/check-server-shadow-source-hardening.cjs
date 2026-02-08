#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const serverDir = path.join(process.cwd(), "server", "js");

if (!fs.existsSync(serverDir)) {
  console.error("server-shadow-hardening-check: missing server/js directory");
  process.exit(1);
}

const entries = fs.readdirSync(serverDir, { withFileTypes: true });
const ctsFiles = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".cts"))
  .map((entry) => entry.name)
  .sort();
const jsFiles = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
  .map((entry) => entry.name)
  .sort();

const nocheckFiles = [];
const missingRuntimeArtifacts = [];
const missingCtsSources = [];

for (const ctsFile of ctsFiles) {
  const fullPath = path.join(serverDir, ctsFile);
  const source = fs.readFileSync(fullPath, "utf8");
  if (source.includes("@ts-nocheck")) {
    nocheckFiles.push(ctsFile);
  }

  const base = ctsFile.slice(0, -4);
  const hasJsArtifact = fs.existsSync(path.join(serverDir, `${base}.js`));
  const hasCjsArtifact = fs.existsSync(path.join(serverDir, `${base}.cjs`));
  if (!hasJsArtifact && !hasCjsArtifact) {
    missingRuntimeArtifacts.push(ctsFile);
  }
}

for (const jsFile of jsFiles) {
  const base = jsFile.slice(0, -3);
  const hasCtsSource = fs.existsSync(path.join(serverDir, `${base}.cts`));
  if (!hasCtsSource) {
    missingCtsSources.push(jsFile);
  }
}

if (nocheckFiles.length || missingRuntimeArtifacts.length || missingCtsSources.length) {
  if (nocheckFiles.length) {
    console.error("server-shadow-hardening-check: @ts-nocheck present in:");
    for (const file of nocheckFiles) {
      console.error(`  - ${file}`);
    }
  }

  if (missingRuntimeArtifacts.length) {
    console.error("server-shadow-hardening-check: missing runtime artifact for:");
    for (const file of missingRuntimeArtifacts) {
      console.error(`  - ${file}`);
    }
  }

  if (missingCtsSources.length) {
    console.error("server-shadow-hardening-check: runtime .js missing .cts source:");
    for (const file of missingCtsSources) {
      console.error(`  - ${file}`);
    }
  }

  process.exit(1);
}

console.log(
  `server-shadow-hardening-check: ok (${ctsFiles.length} .cts sources, ${jsFiles.length} .js runtime artifacts)`
);
