import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** npm package root (contains helix-api/, helix-webui/, docker/). */
export function packageRoot() {
  return path.resolve(__dirname, '..');
}

export function composeFile() {
  return path.join(packageRoot(), 'docker', 'docker-compose.npx.yml');
}

export const composeProject = 'helix-npx';

export function userConfigDir() {
  return path.join(os.homedir(), '.helix');
}

export function userConfigFile() {
  return path.join(userConfigDir(), 'helix.config.yaml');
}

export function ensureUserConfig() {
  const dir = userConfigDir();
  const target = userConfigFile();
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(target)) {
    const example = path.join(
      packageRoot(),
      'helix-api',
      'helix.config.example.yaml',
    );
    fs.copyFileSync(example, target);
    console.log(`Created ${target} (edit secrets there or use the Web UI Settings).`);
  }
  return target;
}
