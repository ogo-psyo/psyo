import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const baseline = JSON.parse(fs.readFileSync(new URL('./refactor-baseline.json', import.meta.url), 'utf8'));
const result = spawnSync('npx', ['eslint', '.', '--format', 'json'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

let report;
try {
  report = JSON.parse(result.stdout || '[]');
} catch (error) {
  process.stderr.write(result.stdout);
  process.stderr.write(result.stderr);
  throw error;
}

const totals = report.reduce((acc, file) => {
  acc.errors += file.errorCount ?? 0;
  acc.warnings += file.warningCount ?? 0;
  return acc;
}, { errors: 0, warnings: 0 });

const delta = totals.warnings - baseline.eslintWarnings;
console.log(`ESLint errors: ${totals.errors}`);
console.log(`ESLint warnings: ${totals.warnings}`);
console.log(`ESLint warning budget: ${baseline.eslintWarnings}`);
console.log(`ESLint warning delta: ${delta >= 0 ? '+' : ''}${delta}`);

if (totals.errors > 0 || result.status !== 0) {
  process.stderr.write(result.stderr);
  console.error('ESLint failed: errors are not allowed.');
  process.exit(1);
}

if (totals.warnings > baseline.eslintWarnings) {
  console.error('ESLint warning budget exceeded.');
  process.exit(1);
}
