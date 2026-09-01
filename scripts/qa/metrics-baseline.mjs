import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../../app/page.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../../app/globals.css', import.meta.url), 'utf8');
const sourceRoots = ['app', 'lib', 'components', 'packages'];
const { execFileSync } = await import('node:child_process');

const explicitAny = Number(execFileSync('sh', ['-c', `grep -rnoE '(: any\\b|as any\\b|: any\\[|<any[,>])' --include='*.ts' --include='*.tsx' ${sourceRoots.join(' ')} | wc -l`], { encoding: 'utf8' }).trim());
const metrics = {
  baselineSha: 'dd541d0',
  pageLines: page.split('\n').length - 1,
  globalsCssLines: styles.split('\n').length - 1,
  useState: (page.match(/useState(?:<|\()/g) ?? []).length,
  useEffect: (page.match(/useEffect\(/g) ?? []).length,
  explicitAny,
};

console.log(JSON.stringify(metrics, null, 2));
