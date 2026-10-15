#!/usr/bin/env node
// helix: lifecycle CLI for the local Docker stack (compose project "helix").
// One alias covers both helix-api and helix-webui. Built-ins only.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const CLI_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(CLI_DIR, '..', '..');
const API_DIR = path.join(REPO, 'helix-api');
const COMPOSE_FILE = path.join(API_DIR, 'docker-compose.local.yml');
const APP_DIR = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.config'), 'helix');
const CONFIG_FILE = path.join(APP_DIR, 'config.json');
const CURSOR_AUTH = path.join(process.env.APPDATA || '', 'Cursor', 'auth.json');

const PROJECT = 'helix';
const CONTAINERS = ['helix-api', 'helix-webui'];
const VOLUMES = ['helix-sqlite-data', 'helix-pip-cache', 'helix-webui-node-modules'];
const NETWORK = 'helix-net';
const DEFAULT_PORT = 5178; // WebUI host port
const API_PORT = 8173; // API host port (fixed in compose)
const EXIT = { ok: 0, usage: 2, stopped: 3, notInstalled: 4 };

const step = (msg) => console.log(`>> ${msg}`);
const ok = (msg) => console.log(`OK  ${msg}`);
const warn = (msg) => console.log(`WARN ${msg}`);
const fail = (msg, code = 1) => {
  console.error(`ERR ${msg}`);
  process.exit(code);
};

const USAGE = `helix <command> [options]

Commands:
  status                         installed, version, running, URLs (0 running / 3 stopped / 4 not installed)
  version                        installed vs source version
  run [--port=N]                 start stack, wait up to 30s for WebUI
  stop                           stop containers (volumes kept)
  port [--port=N]                show, or set and save WebUI port (restarts if running)
  update                         git pull --ff-only, then rebuild keeping data
  rebuild [--remove-data=no|yes] [-y]
                                 rebuild images; "yes" wipes DB volume, caches and config
  uninstall [--remove-data=yes] [-y]
                                 stop, unlink CLI, delete config (data kept unless yes)
  service <...>                  not used in Docker mode (exit 2)
  help                           this text

Options: --port=N or --port N. -y skips confirmation.`;

function usage(code = EXIT.usage) {
  console.log(USAGE);
  process.exit(code);
}

function parseArgs(argv) {
  const [command = 'help', ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '-y' || a === '--yes') {
      flags.yes = true;
      continue;
    }
    const [name, inline] = a.startsWith('--') ? a.split(/=(.*)/s) : [null];
    const value = inline ?? rest[i + 1];
    if (name === '--port') flags.port = value;
    else if (name === '--remove-data') flags.removeData = value;
    else return { command, flags, unknown: true };
    if (inline === undefined) i++;
    if (value === undefined) return { command, flags, unknown: true };
  }
  return { command, flags };
}

function loadConfig() {
  return fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : null;
}

function saveConfig(cfg) {
  fs.mkdirSync(APP_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

const portOf = (cfg) => cfg?.port ?? DEFAULT_PORT;
const webUrl = (cfg) => `http://127.0.0.1:${portOf(cfg)}/helix/`;
const apiUrl = `http://127.0.0.1:${API_PORT}`;

// Dead localhost proxy vars break Docker pulls/builds (same fix as redeploy-stack.ps1).
function cleanEnv(extra) {
  const env = { ...process.env, ...extra };
  for (const k of Object.keys(env)) {
    if (/^(http|https|all|no)_proxy$/i.test(k) && /(^|\/\/)(localhost|127\.0\.0\.1)(:|\/|$)/i.test(env[k])) {
      delete env[k];
    }
  }
  return env;
}

function docker(args, { inherit = false, env, cwd } = {}) {
  return spawnSync('docker', args, {
    cwd,
    env: cleanEnv(env),
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
}

const dockerOk = () => docker(['info']).status === 0;

function compose(args, cfg) {
  const r = docker(['compose', '-p', PROJECT, '-f', COMPOSE_FILE, ...args], {
    inherit: true,
    cwd: API_DIR,
    env: { HELIX_PORT: String(portOf(cfg)) },
  });
  return r.status ?? 1;
}

function requireDocker() {
  if (!dockerOk()) fail('Docker daemon not reachable. Start Docker Desktop and retry.');
}

function requireInstalled(cfg) {
  if (!cfg) fail('Not installed. Run: helix rebuild', EXIT.notInstalled);
}

function runningNames() {
  const r = docker(['ps', '--filter', `label=com.docker.compose.project=${PROJECT}`, '--format', '{{.Names}}']);
  return r.status === 0 ? r.stdout.split(/\r?\n/).filter((n) => CONTAINERS.includes(n.trim())) : [];
}

function ensureInfra() {
  if (docker(['network', 'inspect', NETWORK]).status !== 0) {
    step(`Creating network ${NETWORK}`);
    if (docker(['network', 'create', NETWORK]).status !== 0) fail(`Failed to create network ${NETWORK}`);
  }
  for (const v of VOLUMES) docker(['volume', 'create', v]);
}

function sourceVersion() {
  const r = spawnSync('git', ['-C', REPO, 'describe', '--tags', '--always', '--dirty'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : 'unknown';
}

function probe(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 2000 }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
  });
}

async function waitForUrl(url, ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await probe(url)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function portFree(n) {
  return new Promise((resolve) => {
    const srv = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => srv.close(() => resolve(true)))
      .listen(n, '127.0.0.1');
  });
}

async function confirm(question, assumeYes) {
  if (assumeYes) return;
  if (!process.stdin.isTTY) fail('Destructive action needs confirmation. Re-run with -y.', EXIT.usage);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  if (!/^y(es)?$/i.test(answer.trim())) {
    console.log('Aborted.');
    process.exit(0);
  }
}

function removeVolumes() {
  for (const v of VOLUMES) {
    step(`Removing volume ${v}`);
    docker(['volume', 'rm', '-f', v]);
  }
}

async function cmdStatus(cfg) {
  if (!cfg) {
    console.log('installed : no (run: helix rebuild)');
    return EXIT.notInstalled;
  }
  requireDocker();
  const running = runningNames();
  const isRunning = running.length === CONTAINERS.length;
  const cur = sourceVersion();
  console.log(`installed : yes (version ${cfg.installedVersion ?? 'unknown'})`);
  if (cfg.installedVersion && cfg.installedVersion !== cur) {
    warn(`source is ${cur}; run: helix rebuild`);
  }
  console.log(`mode      : docker (project ${PROJECT})`);
  console.log(`compose   : ${COMPOSE_FILE}`);
  console.log(`config    : ${CONFIG_FILE}`);
  console.log(`port      : ${portOf(cfg)}`);
  console.log(`running   : ${running.length ? running.join(', ') : 'none'}`);
  console.log(`webui     : ${webUrl(cfg)} (${(await probe(webUrl(cfg))) ?? 'no response'})`);
  console.log(`api       : ${apiUrl} (${(await probe(apiUrl)) ?? 'no response'})`);
  if (running.length && !isRunning) warn('only part of the stack is running; run: helix run');
  return isRunning ? EXIT.ok : EXIT.stopped;
}

function cmdVersion(cfg) {
  console.log(`installed : ${cfg?.installedVersion ?? 'not installed'}`);
  console.log(`source    : ${sourceVersion()}`);
  if (cfg?.installedVersion && cfg.installedVersion !== sourceVersion()) {
    warn('mismatch; run: helix rebuild');
  }
  return EXIT.ok;
}

async function applyPort(cfg, value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535) fail(`Invalid port: ${value}`, EXIT.usage);
  const running = runningNames().length > 0;
  if ((!running || n !== portOf(cfg)) && !(await portFree(n))) fail(`Port ${n} is in use.`);
  const next = { ...cfg, port: n };
  saveConfig(next);
  ok(`Port saved: ${n}`);
  return next;
}

async function startStack(cfg) {
  requireDocker();
  ensureInfra();
  step('Starting stack (volumes preserved)');
  if (compose(['up', '-d'], cfg) !== 0) fail('docker compose up failed.');
  step(`Waiting for WebUI at ${webUrl(cfg)}`);
  if (await waitForUrl(webUrl(cfg), 30_000)) ok(`WebUI up: ${webUrl(cfg)}`);
  else warn('WebUI not answering yet. First start can take longer (npm install). Check: helix status');
  console.log(`API       : ${apiUrl}`);
}

async function cmdRun(cfg, flags) {
  requireInstalled(cfg);
  let current = cfg;
  if (flags.port !== undefined) current = await applyPort(cfg, flags.port);
  requireDocker();
  if (flags.port === undefined && runningNames().length === CONTAINERS.length) {
    console.log('Already running.');
    return cmdStatus(current);
  }
  await startStack(current);
  return EXIT.ok;
}

function cmdStop(cfg) {
  requireInstalled(cfg);
  if (!dockerOk()) {
    console.log('Docker not reachable; nothing to stop.');
    return EXIT.ok;
  }
  step('Stopping stack');
  if (compose(['stop'], cfg) !== 0) fail('docker compose stop failed.');
  ok(`Stopped. Running: ${runningNames().join(', ') || 'none'}`);
  return EXIT.ok;
}

async function cmdPort(cfg, flags) {
  requireInstalled(cfg);
  if (flags.port === undefined) {
    console.log(portOf(cfg));
    return EXIT.ok;
  }
  const next = await applyPort(cfg, flags.port);
  if (runningNames().length > 0) await startStack(next);
  return EXIT.ok;
}

async function cmdRebuild(cfg, flags) {
  const removeData = flags.removeData ?? 'no';
  if (!['no', 'yes'].includes(removeData)) fail('--remove-data must be no or yes', EXIT.usage);
  requireDocker();
  if (!fs.existsSync(CURSOR_AUTH)) {
    fail(`Cursor IDE auth.json not found at ${CURSOR_AUTH}. Sign in to Cursor IDE first.`);
  }
  const wipe = removeData === 'yes';
  if (wipe) {
    await confirm(
      `Deletes DB volume helix-sqlite-data, caches (${VOLUMES.join(', ')}) and config ${CONFIG_FILE}. Continue? [y/N] `,
      flags.yes,
    );
  }

  // Build first: a failed build leaves the running stack untouched.
  ensureInfra();
  step('Building images (no cache, pull bases)');
  if (compose(['build', '--no-cache', '--pull'], cfg) !== 0) {
    fail('docker compose build failed. Stack left as it was; fix the error and re-run.');
  }

  step('Stopping stack');
  compose(['down', '--remove-orphans', ...(wipe ? ['-v', '--rmi', 'local'] : [])], cfg);
  if (wipe) {
    removeVolumes();
    fs.rmSync(CONFIG_FILE, { force: true });
  }
  ensureInfra();

  const next = {
    port: wipe ? DEFAULT_PORT : portOf(cfg),
    mode: 'docker',
    project: PROJECT,
    composeFile: COMPOSE_FILE,
    installedVersion: sourceVersion(),
  };
  saveConfig(next);
  await startStack(next);
  ok(`Rebuilt (data ${wipe ? 'wiped' : 'kept'}).`);
  return EXIT.ok;
}

async function cmdUpdate(cfg) {
  requireInstalled(cfg);
  step('git pull --ff-only');
  const r = spawnSync('git', ['-C', REPO, 'pull', '--ff-only'], { stdio: 'inherit' });
  if (r.status !== 0) fail('git pull failed. Nothing rebuilt.');
  return cmdRebuild(cfg, { removeData: 'no' });
}

async function cmdUninstall(cfg, flags) {
  const wipe = flags.removeData === 'yes';
  await confirm(
    `Stops the stack, unlinks the helix CLI and deletes ${CONFIG_FILE}. ` +
      `${wipe ? 'DB and cache volumes WILL be deleted.' : 'Data volumes are kept.'} Continue? [y/N] `,
    flags.yes,
  );
  if (dockerOk()) {
    step('Stopping stack');
    compose(['down', '--remove-orphans', ...(wipe ? ['-v', '--rmi', 'local'] : [])], cfg);
    if (wipe) removeVolumes();
  }
  fs.rmSync(APP_DIR, { recursive: true, force: true });
  step('Unlinking CLI');
  spawnSync('npm', ['unlink', '--global', 'helix-cli'], { cwd: CLI_DIR, shell: process.platform === 'win32' });
  ok('Uninstalled. Repo files untouched.');
  return EXIT.ok;
}

async function main() {
  const { command, flags, unknown } = parseArgs(process.argv.slice(2));
  if (unknown) usage();
  const cfg = loadConfig();
  switch (command) {
    case 'help':
    case '--help':
    case '-h':
      console.log(USAGE);
      return EXIT.ok;
    case 'status':
      return cmdStatus(cfg);
    case 'version':
      return cmdVersion(cfg);
    case 'run':
      return cmdRun(cfg, flags);
    case 'stop':
      return cmdStop(cfg);
    case 'port':
      return cmdPort(cfg, flags);
    case 'update':
      return cmdUpdate(cfg);
    case 'rebuild':
      return cmdRebuild(cfg, flags);
    case 'uninstall':
      return cmdUninstall(cfg, flags);
    case 'service':
      console.log('Service mode is not used; this install runs in Docker mode.');
      return EXIT.usage;
    default:
      usage();
  }
}

process.exitCode = await main();
