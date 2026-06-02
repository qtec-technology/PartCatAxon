const { spawn } = require('child_process');
const path = require('path');

const nextRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(nextRoot, '..');
const isWindows = process.platform === 'win32';

const env = { ...process.env };
// Windows can expose both keys; Node child_process rejects duplicate Path/PATH.
if (env.Path && env.PATH) {
  delete env.PATH;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(url, timeoutMs) {
  const started = Date.now();
  let lastError = '';

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(1000);
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

function killTree(pid) {
  if (!pid) return Promise.resolve();

  return new Promise((resolve) => {
    if (isWindows) {
      const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.on('exit', resolve);
      killer.on('error', resolve);
      return;
    }

    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        // Process is already gone.
      }
    }
    resolve();
  });
}

function spawnDevServer() {
  const command = isWindows ? (process.env.ComSpec || 'cmd.exe') : 'npm';
  const args = isWindows ? ['/d', '/s', '/c', 'npm.cmd run dev'] : ['run', 'dev'];

  return spawn(command, args, {
    cwd: repoRoot,
    env,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function spawnPlaywright(args) {
  const cli = require.resolve('@playwright/test/cli');
  return spawn(process.execPath, [cli, 'test', ...args], {
    cwd: nextRoot,
    env: {
      ...env,
      PLAYWRIGHT_SKIP_WEBSERVER: '1',
    },
    shell: false,
    stdio: 'inherit',
  });
}

async function main() {
  const passthroughArgs = process.argv.slice(2);
  const dev = spawnDevServer();
  let shuttingDown = false;

  const stop = async (exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    await killTree(dev.pid);
    process.exit(exitCode);
  };

  dev.stdout.on('data', (chunk) => process.stdout.write(`[dev] ${chunk}`));
  dev.stderr.on('data', (chunk) => process.stderr.write(`[dev] ${chunk}`));
  dev.on('error', (error) => {
    console.error(error);
    void stop(1);
  });

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => void stop(130));
  }

  await waitFor('http://127.0.0.1:3010/bulk-cost', 120_000);

  const playwright = spawnPlaywright(passthroughArgs);
  playwright.on('exit', (code, signal) => {
    const exitCode = code ?? (signal ? 1 : 0);
    void stop(exitCode);
  });
  playwright.on('error', (error) => {
    console.error(error);
    void stop(1);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
