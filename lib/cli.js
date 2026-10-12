import { readFileSync } from 'node:fs';
import path from 'node:path';

import { printUrls, runCompose } from './docker.js';
import { composeFile, packageRoot } from './paths.js';

const pkg = JSON.parse(
  readFileSync(path.join(packageRoot(), 'package.json'), 'utf8'),
);

function help() {
  console.log(`Helix ${pkg.version} — warehouse LLM analytics (Docker)

Usage:
  npx @armindashti/helix <command>

Commands:
  up, start     Build images (if needed) and start API + Web UI
  down, stop    Stop containers (keeps data volumes)
  logs          Follow container logs
  ps            Show stack status
  doctor        Check Docker and compose file
  help          Show this message

Examples:
  npx @armindashti/helix up
  npx @armindashti/helix down

First run creates ~/.helix/helix.config.yaml from the example template.
Set OPENROUTER_TOKEN in the environment or paste a key in Settings after start.
`);
}

export async function runCli(argv) {
  const [cmd = 'help', ...rest] = argv;

  switch (cmd) {
    case 'help':
    case '-h':
    case '--help':
      help();
      return;

    case 'doctor': {
      const { assertDocker } = await import('./docker.js');
      try {
        assertDocker();
        console.log('Docker: ok');
      } catch (e) {
        console.error(`Docker: ${e.message}`);
        process.exit(1);
      }
      console.log(`Package root: ${packageRoot()}`);
      console.log(`Compose file: ${composeFile()}`);
      const code = runCompose(['config'], { inherit: false });
      if (code !== 0) process.exit(code);
      console.log('Compose config: ok');
      printUrls();
      return;
    }

    case 'up':
    case 'start': {
      const extra = rest.includes('--no-build')
        ? rest.filter((a) => a !== '--no-build')
        : rest;
      const upArgs = ['up', '-d'];
      if (!rest.includes('--no-build')) upArgs.push('--build');
      upArgs.push(...extra);
      const code = runCompose(upArgs);
      if (code !== 0) process.exit(code);
      printUrls();
      return;
    }

    case 'down':
    case 'stop': {
      const code = runCompose(['down', ...rest]);
      process.exit(code);
      return;
    }

    case 'logs': {
      const code = runCompose(['logs', '-f', ...rest]);
      process.exit(code);
      return;
    }

    case 'ps':
    case 'status': {
      const code = runCompose(['ps', ...rest]);
      process.exit(code);
      return;
    }

    default:
      console.error(`Unknown command: ${cmd}\n`);
      help();
      process.exit(1);
  }
}
