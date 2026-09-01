import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const baseline = JSON.parse(await readFile(new URL('./knip-baseline.json', import.meta.url), 'utf8'));
const command = process.platform === 'win32' ? 'knip.cmd' : './node_modules/.bin/knip';
const result = spawnSync(command, ['--reporter', 'json'], { encoding: 'utf8' });

if (!result.stdout.trim()) {
  process.stderr.write(result.stderr || 'Knip produced no JSON output.\n');
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch (error) {
  process.stderr.write(`Could not parse Knip JSON: ${error.message}\n${result.stderr}`);
  process.exit(1);
}

function normalize(reportValue) {
  const keys = [];
  for (const file of reportValue.files ?? []) keys.push(`file:${file}`);
  for (const issue of reportValue.issues ?? []) {
    for (const [type, values] of Object.entries(issue)) {
      if (['file', 'enumMembers', 'duplicates', 'catalog'].includes(type) || !Array.isArray(values)) continue;
      for (const item of values) keys.push(`${type}:${issue.file}:${item.name ?? item.symbol ?? item}`);
    }
    for (const [enumName, members] of Object.entries(issue.enumMembers ?? {})) {
      for (const member of members) keys.push(`enumMember:${issue.file}:${enumName}.${member.name ?? member}`);
    }
    for (const duplicate of issue.duplicates ?? []) {
      keys.push(`duplicate:${issue.file}:${duplicate.name ?? JSON.stringify(duplicate)}`);
    }
  }
  return [...new Set(keys)].sort();
}

const current = normalize(report);
const allowed = new Set(baseline.findings);
const currentSet = new Set(current);
const added = current.filter((finding) => !allowed.has(finding));
const resolved = baseline.findings.filter((finding) => !currentSet.has(finding));

console.log(`Knip baseline: remaining=${current.length - added.length} resolved=${resolved.length} new=${added.length}`);
if (resolved.length) console.log(`Resolved:\n${resolved.map((item) => `- ${item}`).join('\n')}`);
if (added.length) {
  console.error(`New findings:\n${added.map((item) => `- ${item}`).join('\n')}`);
  process.exitCode = 1;
}
