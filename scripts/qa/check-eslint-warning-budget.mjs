import { readFile } from 'node:fs/promises';
import { ESLint } from 'eslint';

const baseline = JSON.parse(await readFile(new URL('./refactor-baseline.json', import.meta.url), 'utf8'));
const eslint = new ESLint();
const results = await eslint.lintFiles(['app', 'components', 'lib', 'packages', 'scripts']);
const formatter = await eslint.loadFormatter('stylish');
const output = formatter.format(results);
if (output) process.stdout.write(output);

const errors = results.reduce((sum, result) => sum + result.errorCount, 0);
const warnings = results.reduce((sum, result) => sum + result.warningCount, 0);
console.log(`ESLint warning budget: current=${warnings} baseline=${baseline.eslintWarnings} delta=${warnings - baseline.eslintWarnings}`);

if (errors > 0 || warnings > baseline.eslintWarnings) process.exitCode = 1;
