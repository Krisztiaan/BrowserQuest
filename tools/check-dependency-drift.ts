import * as fs from 'node:fs';
import { spawnSync } from 'node:child_process';

function parseArgs(argv) {
  const options = {
    allowDrift: false,
    textPath: null,
    jsonPath: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--allow-drift') {
      options.allowDrift = true;
      continue;
    }
    if (arg === '--text') {
      i += 1;
      if (i >= argv.length) {
        throw new Error('Missing value for --text');
      }
      options.textPath = argv[i];
      continue;
    }
    if (arg === '--json') {
      i += 1;
      if (i >= argv.length) {
        throw new Error('Missing value for --json');
      }
      options.jsonPath = argv[i];
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function parseOutdatedRows(rawOutput) {
  const lines = rawOutput.split(/\r?\n/);
  const rows = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith('|')) {
      continue;
    }

    // Skip table borders and headers.
    if (/^\|[-\s|]+\|$/.test(line)) {
      continue;
    }
    if (line.includes('Package') && line.includes('Current') && line.includes('Latest')) {
      continue;
    }

    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.length < 4) {
      continue;
    }

    rows.push({
      package: cells[0],
      current: cells[1],
      update: cells[2],
      latest: cells[3],
    });
  }

  return rows;
}

function writeIfRequested(path, content) {
  if (!path) {
    return;
  }
  fs.writeFileSync(path, content);
}

function main() {
  let options;
  try {
    options = parseArgs(Bun.argv.slice(2));
  } catch (error) {
    console.error(`dependency-drift-check: ${error.message}`);
    process.exit(2);
  }

  const run = spawnSync('bun', ['outdated', '--no-progress'], { encoding: 'utf8' });

  if (run.error) {
    console.error(`dependency-drift-check: failed to run bun outdated: ${run.error.message}`);
    process.exit(2);
  }
  if (run.status !== 0) {
    const stderr = run.stderr ? run.stderr.trim() : '';
    const stdout = run.stdout ? run.stdout.trim() : '';
    if (stdout) {
      console.error(stdout);
    }
    if (stderr) {
      console.error(stderr);
    }
    console.error(`dependency-drift-check: bun outdated exited with status ${run.status}`);
    process.exit(run.status || 2);
  }

  const rawOutput = run.stdout || '';
  const rows = parseOutdatedRows(rawOutput);
  const driftDetected = rows.length > 0;

  const summaryLines = [];
  if (!driftDetected) {
    summaryLines.push('No direct dependency drift detected.');
  } else {
    summaryLines.push('Direct dependency drift detected:');
    for (const row of rows) {
      summaryLines.push(
        `- ${row.package}: current=${row.current}, update=${row.update}, latest=${row.latest}`
      );
    }
  }
  const summaryText = summaryLines.join('\n');

  writeIfRequested(options.textPath, `${summaryText}\n`);
  writeIfRequested(
    options.jsonPath,
    JSON.stringify(
      {
        driftDetected,
        packages: rows,
        summary: summaryLines,
        rawOutput,
      },
      null,
      2
    ) + '\n'
  );

  if (!driftDetected) {
    console.log('dependency-drift-check: ok (no direct dependency drift).');
    process.exit(0);
  }

  console.error('dependency-drift-check: detected direct dependency drift.');
  for (const row of rows) {
    console.error(
      `  - ${row.package}: current=${row.current}, update=${row.update}, latest=${row.latest}`
    );
  }

  if (options.allowDrift) {
    process.exit(0);
  }
  process.exit(1);
}

main();
