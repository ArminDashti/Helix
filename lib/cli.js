import { readFileSync } from 'node:fs';
import path from 'node:path';

import { assertDocker, printUrls, runCompose } from './docker.js';
import { packageRoot } from './paths.js';

const pkg = JSON.parse(
  readFileSync(path.join(packageRoot(), 'package.json'), 'utf8'),
);
const DEFAULT_PORT = 8181;
const API_PORT = 8173;

function help() {
  console.log(`Helix ${pkg.version} — warehouse LLM analytics (Docker)

Usage:
  helix <command> [options]

Commands:
  run [--port=N]             Build and start the stack detached
  help                       Show this message
  version                    Show the CLI version
  status                     Docker check, container state, endpoint health
  service status             Show container state
  service start [--port=N]   Start containers (builds only if missing)
  service stop               Stop containers (keeps data volume)
  service restart            Restart containers
  update                     Rebuild images and recreate containers (keeps data)
  rebuild [--port=N]         Stop all instances, rebuild from local sources, run again

Options:
  --port=N   Web UI host port, 1024-65535 (default ${DEFAULT_PORT}). API stays on ${API_PORT}.
`);
}

function ensureDocker() {
  try {
    assertDocker();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

/** Runs docker compose; exits the CLI with the compose exit code on failure. */
function compose(args) {
  ensureDocker();
  const code = runCompose(args);
  if (code !== 0) process.exit(code);
}

/** Parses --port (both `--port=N` and `--port N`) and exports it to compose. */
function usePort(args) {
  const i = args.findIndex((a) => a === '--port' || a.startsWith('--port='));
  const raw =
    i === -1 ? String(DEFAULT_PORT) : args[i].includes('=') ? args[i].split('=')[1] : args[i + 1];
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    console.error(`Invalid --port: ${raw}. Use 1024-65535.`);
    process.exit(1);
  }
  process.env.HELIX_WEBUI_PORT = String(port);
  return port;
}

async function probe(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return r.status < 500 ? 'up' : `HTTP ${r.status}`;
  } catch {
    return 'down';
  }
}

export async function runCli(argv) {
  const [cmd = 'help', sub] = argv;

  switch (cmd) {
    case 'help':
    case '-h':
    case '--help':
      help();
      return;

    case 'version':
    case '-v':
    case '--version':
      console.log(pkg.version);
      return;

    case 'run': {
      const port = usePort(argv);
      compose(['up', '-d', '--build']);
      printUrls(port);
      return;
    }

    case 'status': {
      const port = usePort(argv);
      ensureDocker();
      compose(['ps']);
      console.log(`Web UI : ${await probe(`http://127.0.0.1:${port}/`)}`);
      console.log(`API    : ${await probe(`http://127.0.0.1:${API_PORT}/`)}`);
      return;
    }

    case 'update': {
      const port = usePort(argv);
      compose(['build', '--pull']);
      compose(['up', '-d', '--force-recreate']);
      printUrls(port);
      return;
    }

    case 'rebuild': {
      const port = usePort(argv);
      compose(['down']); // stops and removes containers; named volumes are kept
      compose(['build']);
      compose(['up', '-d']);
      printUrls(port);
      return;
    }

    case 'service':
      switch (sub) {
        case 'status':
          compose(['ps']);
          return;
        case 'start':
          usePort(argv);
          compose(['up', '-d']);
          return;
        case 'stop':
          compose(['stop']);
          return;
        case 'restart':
          usePort(argv);
          compose(['restart']);
          return;
        default:
          console.error(`Unknown service command: ${sub ?? '(none)'}\n`);
          help();
          process.exit(1);
      }

    default:
      console.error(`Unknown command: ${cmd}\n`);
      help();
      process.exit(1);
  }
}
