import { spawnSync } from 'node:child_process';

import {
  composeFile,
  composeProject,
  ensureUserConfig,
  packageRoot,
} from './paths.js';

function dockerAvailable() {
  const r = spawnSync('docker', ['version'], { encoding: 'utf8' });
  return r.status === 0;
}

function dockerDaemonUp() {
  const r = spawnSync('docker', ['info'], { encoding: 'utf8', stdio: 'pipe' });
  return r.status === 0;
}

export function assertDocker() {
  if (!dockerAvailable()) {
    throw new Error(
      'Docker CLI not found. Install Docker Desktop (or docker CE) and ensure docker is on PATH.',
    );
  }
  if (!dockerDaemonUp()) {
    throw new Error('Docker daemon is not reachable. Start Docker and retry.');
  }
}

export function composeEnv() {
  const config = ensureUserConfig();
  return {
    ...process.env,
    HELIX_CONFIG_FILE: config,
    COMPOSE_PROJECT_NAME: composeProject,
  };
}

export function runCompose(args, { inherit = true } = {}) {
  assertDocker();
  const file = composeFile();
  const cmd = [
    'compose',
    '-f',
    file,
    '-p',
    composeProject,
    ...args,
  ];
  const r = spawnSync('docker', cmd, {
    cwd: packageRoot(),
    env: composeEnv(),
    stdio: inherit ? 'inherit' : 'pipe',
  });
  if (!inherit && r.stdout) process.stdout.write(r.stdout);
  if (!inherit && r.stderr) process.stderr.write(r.stderr);
  return r.status ?? 1;
}

export function printUrls() {
  console.log('');
  console.log('Helix is configured for:');
  console.log('  Web UI : http://127.0.0.1:8181/helix/');
  console.log('  API    : http://127.0.0.1:8173/');
  console.log(`  Config : ${ensureUserConfig()}`);
  console.log('');
}
