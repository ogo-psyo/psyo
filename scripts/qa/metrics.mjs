import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const baselineSha = 'dd541d0';
const files = ['app/page.tsx', 'app/globals.css'];

function lineCount(file) {
  return Number(execFileSync('wc', ['-l', file], { encoding: 'utf8' }).trim().split(/\s+/)[0]);
}

function countMatches(file, pattern, ignorePattern = null) {
  const source = fs.readFileSync(file, 'utf8');
  return source.split(/\r?\n/)
    .filter((line) => !ignorePattern?.test(line))
    .reduce((count, line) => count + (line.match(pattern) ?? []).length, 0);
}

function countLinesWithAny(paths) {
  return paths.reduce((count, file) => {
    const source = fs.readFileSync(file, 'utf8');
    return count + source.split(/\r?\n/).filter((line) => /\bany\b/.test(line)).length;
  }, 0);
}

const productTypeFiles = execFileSync('git', ['ls-files', '*.ts', '*.tsx'], { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter((file) => /^(app|components|lib|packages)\//.test(file));

const metrics = {
  baselineSha,
  currentSha: execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(),
  files: Object.fromEntries(files.map((file) => [file, {
    lines: lineCount(file),
  }])),
  reactHooks: {
    useState: countMatches('app/page.tsx', /\buseState\b/g, /^import /),
    useEffect: countMatches('app/page.tsx', /\buseEffect\b/g, /^import /),
  },
  typescript: {
    explicitAny: countLinesWithAny(productTypeFiles),
  },
};

console.log(JSON.stringify(metrics, null, 2));
