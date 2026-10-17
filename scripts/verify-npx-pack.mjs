import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const required = [
  'package.json',
  'bin/helix.js',
  'lib/cli.js',
  'docker/docker-compose.npx.yml',
  'helix-api/dockerfile',
  'helix-api/backend/requirements.txt',
  'helix-api/helix.config.example.yaml',
  'helix-webui/dockerfile',
  'helix-webui/package.json',
  'helix-webui/package-lock.json',
];

for (const rel of required) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`npx pack check failed: missing ${rel}`);
    process.exit(1);
  }
}

console.log('npx pack check: ok');
