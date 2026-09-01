import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const baselinePath = new URL('./knip-baseline.json', import.meta.url);

function normalizePath(value) {
  return String(value ?? '').split(path.sep).join('/').replace(/^\.\//, '');
}

function addFinding(items, type, file, symbol, extra = '') {
  const key = [type, normalizePath(file), symbol ?? '', extra ?? ''].join('|');
  items.add(key);
}

function flattenKnipReport(report) {
  const items = new Set();
  if (!report || typeof report !== 'object') return [];

  for (const [type, value] of Object.entries(report)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') addFinding(items, type, item);
        else if (item && typeof item === 'object') {
          addFinding(items, type, item.file ?? item.path ?? item.name, item.symbol ?? item.name ?? item.exportName, item.type ?? item.owner ?? '');
        }
      }
      continue;
    }

    if (value && typeof value === 'object') {
      for (const [file, entries] of Object.entries(value)) {
        if (Array.isArray(entries)) {
          for (const entry of entries) {
            if (typeof entry === 'string') addFinding(items, type, file, entry);
            else addFinding(items, type, file, entry?.symbol ?? entry?.name ?? entry?.exportName, entry?.type ?? '');
          }
        } else if (entries && typeof entries === 'object') {
          for (const [symbol, detail] of Object.entries(entries)) {
            addFinding(items, type, file, symbol, typeof detail === 'string' ? detail : '');
          }
        } else {
          addFinding(items, type, file);
        }
      }
    }
  }

  return [...items].sort();
}

const result = spawnSync('npx', ['knip', '--reporter', 'json', '--no-exit-code', '--no-progress'], {
  encoding: 'utf8',
  env: { ...process.env, KNIP_DISABLE_RAW_TRANSFER: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (result.error) throw result.error;
if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.stderr.write(result.stdout);
  process.exit(result.status ?? 1);
}

let report;
try {
  report = JSON.parse(result.stdout || '{}');
} catch (error) {
  process.stderr.write(result.stdout);
  process.stderr.write(result.stderr);
  throw error;
}

const current = flattenKnipReport(report);

if (process.env.UPDATE_KNIP_BASELINE === '1') {
  fs.writeFileSync(baselinePath, `${JSON.stringify({
    baselineSha: 'dd541d0',
    generatedAt: new Date().toISOString(),
    findings: current,
  }, null, 2)}\n`);
  console.log(`Knip baseline written: ${current.length} findings`);
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const baselineFindings = new Set(baseline.findings ?? []);
const currentFindings = new Set(current);
const remaining = current.filter((item) => baselineFindings.has(item));
const resolved = [...baselineFindings].filter((item) => !currentFindings.has(item));
const added = current.filter((item) => !baselineFindings.has(item));

console.log(`Knip baseline findings: ${baselineFindings.size}`);
console.log(`Knip remaining findings: ${remaining.length}`);
console.log(`Knip resolved findings: ${resolved.length}`);
console.log(`Knip new findings: ${added.length}`);

if (added.length) {
  console.error(JSON.stringify({ new: added }, null, 2));
  process.exit(1);
}
