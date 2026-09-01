import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const baselineSha = process.env.BASELINE_SHA || 'dd541d0';
const root = process.cwd();
const baseUrl = 'http://127.0.0.1:3101';
const outputRoot = resolve(root, 'scripts/qa/visual-baselines', baselineSha);
const tempRoot = await mkdtemp(join(tmpdir(), 'psyo-visual-baseline-'));
const appWorktree = join(tempRoot, 'app');
let server;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: 'pipe', ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}

async function waitForReady() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`Application did not become ready at ${baseUrl}`);
}

async function hashFile(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function pngHashes(directory) {
  const entries = (await readdir(directory)).filter((name) => name.endsWith('.png')).sort();
  return Object.fromEntries(await Promise.all(entries.map(async (name) => [name, await hashFile(join(directory, name))])));
}

async function comparePngDirectories(firstDirectory, secondDirectory) {
  const names = (await readdir(firstDirectory)).filter((name) => name.endsWith('.png')).sort();
  const comparisons = {};
  for (const name of names) {
    const first = await sharp(join(firstDirectory, name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const second = await sharp(join(secondDirectory, name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (first.info.width !== second.info.width || first.info.height !== second.info.height || first.info.channels !== second.info.channels) {
      comparisons[name] = { stable: false, reason: 'dimensions differ' };
      continue;
    }
    let changedPixels = 0;
    const channels = first.info.channels;
    for (let offset = 0; offset < first.data.length; offset += channels) {
      let changed = false;
      for (let channel = 0; channel < channels; channel += 1) {
        if (Math.abs(first.data[offset + channel] - second.data[offset + channel]) > 10) changed = true;
      }
      if (changed) changedPixels += 1;
    }
    const totalPixels = first.info.width * first.info.height;
    const changedRatio = changedPixels / totalPixels;
    comparisons[name] = { stable: changedRatio <= 0.001, changedPixels, totalPixels, changedRatio };
  }
  return comparisons;
}

async function capture(destination) {
  await mkdir(join(destination, 'design'), { recursive: true });
  await mkdir(join(destination, 'states'), { recursive: true });
  const env = { ...process.env, BASE_URL: baseUrl, CAPTURE_ONLY: '1' };
  run(process.execPath, ['scripts/qa/design-screenshots.mjs'], { env: { ...env, OUT_DIR: join(destination, 'design') } });
  run(process.execPath, ['scripts/qa/design-state-screenshots.mjs'], { env: { ...env, OUT_DIR: join(destination, 'states') } });
}

const status = run('git', ['status', '--porcelain']);
if (status) throw new Error('Visual baseline capture requires a clean worktree.');

try {
  run('git', ['worktree', 'add', '--detach', appWorktree, baselineSha]);
  run('npm', ['ci'], { cwd: appWorktree });
  run('npm', ['run', 'build'], { cwd: appWorktree });

  server = spawn('npm', ['start', '--', '-p', '3101', '-H', '127.0.0.1'], {
    cwd: appWorktree,
    env: { ...process.env, PORT: '3101' },
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForReady();

  await rm(outputRoot, { recursive: true, force: true });
  await capture(outputRoot);
  const repeatRoot = join(tempRoot, 'repeat');
  await capture(repeatRoot);

  const firstDesign = await pngHashes(join(outputRoot, 'design'));
  const firstStates = await pngHashes(join(outputRoot, 'states'));
  const repeatDesign = await pngHashes(join(repeatRoot, 'design'));
  const repeatStates = await pngHashes(join(repeatRoot, 'states'));
  const exactHashesStable = JSON.stringify({ firstDesign, firstStates }) === JSON.stringify({ firstDesign: repeatDesign, firstStates: repeatStates });
  const designPixelComparison = await comparePngDirectories(join(outputRoot, 'design'), join(repeatRoot, 'design'));
  const statePixelComparison = await comparePngDirectories(join(outputRoot, 'states'), join(repeatRoot, 'states'));
  const repeatedCaptureStable = [...Object.values(designPixelComparison), ...Object.values(statePixelComparison)].every((comparison) => comparison.stable);

  const harnessCommit = run('git', ['rev-parse', 'HEAD']);
  const fixtureHash = createHash('sha256')
    .update(await readFile(resolve(root, 'scripts/qa/design-screenshots.mjs')))
    .update(await readFile(resolve(root, 'scripts/qa/design-state-screenshots.mjs')))
    .digest('hex');
  const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const manifest = {
    baselineSha,
    harnessCommit,
    capturedAt: new Date().toISOString(),
    nodeVersion: process.version,
    playwrightVersion: packageJson.devDependencies.playwright,
    browser: 'chromium',
    deviceScaleFactor: 1,
    baseUrl,
    fixtureSource: 'scripts/qa/design-screenshots.mjs + scripts/qa/design-state-screenshots.mjs',
    fixtureVersion: fixtureHash,
    designMetrics: 'design/metrics.json',
    stateMetrics: 'states/metrics.json',
    repeatedCaptureStable,
    exactHashesStable,
    pixelThreshold: { channelDelta: 10, changedPixelRatio: 0.001 },
    designPixelComparison,
    statePixelComparison,
    designPngSha256: firstDesign,
    statePngSha256: firstStates,
  };
  await writeFile(join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  if (!repeatedCaptureStable) throw new Error('Repeated visual capture produced different PNG hashes.');
  console.log(JSON.stringify({ ok: true, outputRoot, images: Object.keys(firstDesign).length + Object.keys(firstStates).length }, null, 2));
} finally {
  if (server?.pid) {
    try { process.kill(process.platform === 'win32' ? server.pid : -server.pid, 'SIGTERM'); } catch {}
  }
  spawnSync('git', ['worktree', 'remove', '--force', appWorktree], { cwd: root, stdio: 'ignore' });
  await rm(tempRoot, { recursive: true, force: true });
}
