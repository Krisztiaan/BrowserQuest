#!/usr/bin/env node

const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');

const rjsPath = path.resolve(__dirname, 'r.js');
const rjsSource = fs.readFileSync(rjsPath, 'utf8');

const runner = new Module(rjsPath, null);
runner.filename = rjsPath;
runner.id = rjsPath;
runner.parent = null;
runner.paths = Module._nodeModulePaths(path.dirname(rjsPath));

const previousRequireMain = require.main;
const previousProcessMain = process.mainModule;

require.main = runner;
process.mainModule = runner;

try {
    runner._compile(rjsSource, rjsPath);
} finally {
    require.main = previousRequireMain;
    process.mainModule = previousProcessMain;
}
