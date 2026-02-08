#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const FILES = {
  consumer: 'docs/legacy-external-consumer-confirmation-protocol.md',
  rollback: 'docs/legacy-retirement-rollback-assignment.md',
  decision: 'docs/legacy-retirement-readiness-decision.md',
};

function parseArgs(argv) {
  return {
    allowBlocked: argv.includes('--allow-blocked'),
    json: argv.includes('--json'),
  };
}

function readFile(relPath) {
  const abs = path.join(ROOT, relPath);
  return fs.readFileSync(abs, 'utf8');
}

function splitTableCells(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
    return null;
  }
  return trimmed
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function isMarkdownSeparatorRow(cells) {
  return cells.every((cell) => /^:?-{2,}:?$/.test(cell.replace(/\s+/g, '')));
}

function stripMarkdownCode(value) {
  return value.replace(/`/g, '').trim();
}

function cellHasPlaceholder(value) {
  return /<[^>]+>/.test(value);
}

function lineStartsWithSection(line, sectionTitle) {
  return line.trim() === sectionTitle;
}

function getLinesInSection(content, sectionTitle) {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => lineStartsWithSection(line, sectionTitle));
  if (start === -1) {
    return [];
  }

  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^##\s+/.test(line)) {
      break;
    }
    out.push(line);
  }
  return out;
}

function collectConsumerIssues(content, issues) {
  if (/Execution status .*`blocked`/.test(content)) {
    issues.push(`${FILES.consumer}: execution status is still blocked.`);
  }

  const responseLines = getLinesInSection(content, '## Response log');
  const tableRows = responseLines
    .map(splitTableCells)
    .filter(Boolean)
    .filter((cells) => cells.length >= 7 && !isMarkdownSeparatorRow(cells))
    .filter((cells) => stripMarkdownCode(cells[0]) !== 'Date (UTC)');

  // Ignore explicit example/template rows to avoid forcing template deletion.
  const actionableRows = tableRows.filter((cells) => {
    const dateCell = stripMarkdownCode(cells[0]);
    return !dateCell.includes('YYYY-MM-DD');
  });

  if (actionableRows.length === 0) {
    issues.push(`${FILES.consumer}: response log has no actionable stakeholder rows.`);
    return;
  }

  for (const row of actionableRows) {
    const [date, stakeholder, response, classification, owner, targetDate] = row.map(
      stripMarkdownCode
    );

    if (
      [date, stakeholder, response, classification, owner, targetDate].some((cell) =>
        cellHasPlaceholder(cell)
      )
    ) {
      issues.push(`${FILES.consumer}: response log contains unresolved placeholders in active rows.`);
      break;
    }
  }

  const unknownRows = actionableRows.filter((row) =>
    stripMarkdownCode(row[3]).toLowerCase().includes('unknown')
  );
  if (unknownRows.length > 0) {
    issues.push(`${FILES.consumer}: unresolved \`unknown\` response classification remains.`);
  }
}

function collectRollbackIssues(content, issues) {
  if (/Execution status .*`blocked`/.test(content)) {
    issues.push(`${FILES.rollback}: execution status is still blocked.`);
  }

  const assignmentLines = getLinesInSection(content, '## Required assignments');
  const assignmentRows = assignmentLines
    .map(splitTableCells)
    .filter(Boolean)
    .filter((cells) => cells.length >= 2 && !isMarkdownSeparatorRow(cells))
    .filter((cells) => stripMarkdownCode(cells[0]) !== 'Field');

  for (const cells of assignmentRows) {
    const field = stripMarkdownCode(cells[0]);
    const value = stripMarkdownCode(cells[1]);
    if (field.toLowerCase().includes('rollback command/runbook reference')) {
      continue;
    }
    if (!value || cellHasPlaceholder(value)) {
      issues.push(`${FILES.rollback}: assignment field "${field}" is unresolved.`);
    }
  }

  const uncheckedChecklist = content.split(/\r?\n/).some((line) => /^\s*-\s*\[ \]\s+/.test(line));
  if (uncheckedChecklist) {
    issues.push(`${FILES.rollback}: execution checklist still has unchecked items.`);
  }
}

function collectDecisionIssues(content, issues) {
  const checklistLines = getLinesInSection(content, '## Decision checklist');
  const checklistRows = checklistLines
    .map(splitTableCells)
    .filter(Boolean)
    .filter((cells) => cells.length >= 3 && !isMarkdownSeparatorRow(cells))
    .filter((cells) => stripMarkdownCode(cells[0]) !== 'Criterion');

  if (checklistRows.length === 0) {
    issues.push(`${FILES.decision}: decision checklist table not found or empty.`);
  } else {
    for (const row of checklistRows) {
      const criterion = stripMarkdownCode(row[0]);
      const state = stripMarkdownCode(row[1]).toLowerCase();
      if (state !== 'pass') {
        issues.push(`${FILES.decision}: decision criterion is not pass -> "${criterion}" (${state}).`);
      }
    }
  }

  const outcomeMatch = content.match(/- Outcome:\s*`([^`]+)`/);
  if (!outcomeMatch) {
    issues.push(`${FILES.decision}: decision outcome line is missing.`);
  } else if (outcomeMatch[1].toLowerCase() !== 'go') {
    issues.push(`${FILES.decision}: decision outcome is not \`go\` (${outcomeMatch[1]}).`);
  }

  const ownerMatch = content.match(/- Decision owner:\s*(.+)/);
  if (!ownerMatch) {
    issues.push(`${FILES.decision}: decision owner line is missing.`);
  } else if (cellHasPlaceholder(ownerMatch[1])) {
    issues.push(`${FILES.decision}: decision owner is unresolved.`);
  }

  const signoffLines = getLinesInSection(content, '## Signoff').filter((line) =>
    /^\s*-\s*Maintainer\s+\d+:/.test(line)
  );
  if (signoffLines.length === 0) {
    issues.push(`${FILES.decision}: maintainer signoff lines are missing.`);
  } else {
    for (const line of signoffLines) {
      if (cellHasPlaceholder(line)) {
        issues.push(`${FILES.decision}: maintainer signoff is unresolved (${line.trim()}).`);
      }
    }
  }
}

function collectIssues(files) {
  const issues = [];
  collectConsumerIssues(files.consumer, issues);
  collectRollbackIssues(files.rollback, issues);
  collectDecisionIssues(files.decision, issues);
  return issues;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = {
    consumer: readFile(FILES.consumer),
    rollback: readFile(FILES.rollback),
    decision: readFile(FILES.decision),
  };

  const issues = collectIssues(files);
  const ready = issues.length === 0;

  if (args.json) {
    process.stdout.write(
      `${JSON.stringify({ ready, issues, files: FILES }, null, 2)}\n`
    );
    process.exit(ready || args.allowBlocked ? 0 : 1);
  }

  if (ready) {
    console.log('legacy-signoff-readiness: ok (external signoff docs are ready for cutover).');
    process.exit(0);
  }

  console.error('legacy-signoff-readiness: blocked (external signoff inputs still required).');
  for (const issue of issues) {
    console.error(`  - ${issue}`);
  }

  if (args.allowBlocked) {
    process.exit(0);
  }
  process.exit(1);
}

main();
