const { spawn } = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const isWindows = process.platform === 'win32';
const command = isWindows ? (process.env.ComSpec || 'cmd.exe') : 'npm';
const args = isWindows ? ['/d', '/s', '/c', 'npm.cmd run dev'] : ['run', 'dev'];

const env = { ...process.env };
// Some Windows shells expose both Path and PATH; child_process rejects that.
if (env.Path && env.PATH) {
  delete env.PATH;
}

const child = spawn(command, args, {
  cwd: repoRoot,
  env,
  shell: false,
  stdio: 'inherit',
});

let shuttingDown = false;

function killTree(pid) {
  if (!pid) return;
  if (isWindows) {
    spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
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
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  killTree(child.pid);
  windowlessExit(exitCode);
}

function windowlessExit(exitCode) {
  setTimeout(() => {
    process.exit(exitCode);
  }, 750).unref();
}

child.on('exit', (code, signal) => {
  if (shuttingDown) return;
  process.exit(code ?? (signal ? 1 : 0));
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => shutdown(0));
}

process.on('exit', () => {
  if (!shuttingDown) {
    killTree(child.pid);
  }
});
