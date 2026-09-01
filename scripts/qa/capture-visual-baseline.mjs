import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const baselineSha = process.env.BASELINE_SHA || 'dd541d0';
const port = Number(process.env.PORT || 3101);
const baseUrl = process.env.BASE_URL || `http://127.0.0.1:${port}`;
const outRoot = path.join(repoRoot, 'scripts/qa/visual-baselines', baselineSha);
const worktreePath = path.join(repoRoot, '.tmp', `visual-baseline-${baselineSha}`);

function git(args, options = {}) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8', ...options });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout.trim();
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: 'inherit', ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`);
}

async function waitForReady(url, timeoutMs = 60_000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? 'unknown error'}`);
}

function startServer() {
  return spawn('npm', ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: worktreePath,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), NEXT_TELEMETRY_DISABLED: '1' },
  });
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 5_000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function fileSha256(file) {
  const data = await fs.readFile(file);
  return createHash('sha256').update(data).digest('hex');
}

const status = git(['status', '--short']);
if (status) {
  throw new Error(`visual baseline capture requires a clean worktree:\n${status}`);
}

let server;
try {
  await fs.rm(worktreePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  await fs.rm(outRoot, { recursive: true, force: true });
  await fs.mkdir(path.dirname(worktreePath), { recursive: true });
  await fs.mkdir(path.join(outRoot, 'design'), { recursive: true });
  await fs.mkdir(path.join(outRoot, 'states'), { recursive: true });

  git(['worktree', 'add', '--detach', worktreePath, baselineSha]);
  run('npm', ['ci'], { cwd: worktreePath });

  server = startServer();
  const serverLog = [];
  server.stdout.on('data', (chunk) => serverLog.push(chunk.toString()));
  server.stderr.on('data', (chunk) => serverLog.push(chunk.toString()));
  await waitForReady(baseUrl);

  run('node', ['scripts/qa/design-screenshots.mjs'], {
    cwd: repoRoot,
    env: { ...process.env, BASE_URL: baseUrl, OUT_DIR: path.join(outRoot, 'design') },
  });
  run('node', ['scripts/qa/design-state-screenshots.mjs'], {
    cwd: repoRoot,
    env: { ...process.env, BASE_URL: baseUrl, OUT_DIR: path.join(outRoot, 'states') },
  });

  const playwrightVersion = JSON.parse(await fs.readFile(path.join(repoRoot, 'node_modules/playwright/package.json'), 'utf8')).version;
  const manifest = {
    baselineSha,
    capturedByCommit: git(['rev-parse', 'HEAD']),
    capturedAt: new Date().toISOString(),
    nodeVersion: process.version,
    playwrightVersion,
    browser: 'chromium',
    deviceScaleFactor: 1,
    baseUrl,
    fixtureSource: 'scripts/qa/design-state-screenshots.mjs',
    fixtureVersion: await fileSha256(path.join(repoRoot, 'scripts/qa/design-state-screenshots.mjs')),
    designMetrics: 'design/metrics.json',
    stateMetrics: 'states/metrics.json',
  };
  await fs.writeFile(path.join(outRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.writeFile(path.join(outRoot, 'server.log'), serverLog.join(''));
  console.log(`Visual baseline captured in ${outRoot}`);
} finally {
  await stopServer(server);
  spawnSync('git', ['worktree', 'remove', '--force', worktreePath], { cwd: repoRoot, stdio: 'ignore' });
  await fs.rm(worktreePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
