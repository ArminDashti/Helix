# Helix

LLM-powered SELECT-only warehouse analytics — Django API and React Web UI.

## Quick start (npx)

Requires [Docker](https://docs.docker.com/get-docker/) and Node.js 18+.

```bash
npx @armindashti/helix up
```

- Web UI: http://127.0.0.1:8181/helix/
- API: http://127.0.0.1:8173/

On first run the CLI creates `~/.helix/helix.config.yaml` from the example template. Set `OPENROUTER_TOKEN` in your environment or add a provider key in **Settings** after sign-in.

```bash
npx @armindashti/helix doctor   # Docker + compose sanity check
npx @armindashti/helix down      # stop containers (data volume kept)
npx @armindashti/helix logs      # follow logs
```

### Publish to npm

From this repo root (after `npm login`):

```bash
npm publish --access public
```

## Local development (this monorepo)

Hot-reload Docker stack (Windows):

```powershell
.\scripts\install-local-docker.ps1
```

- Web UI: http://127.0.0.1:5178/helix/
- API: http://127.0.0.1:8173/

See [helix-api/README.md](helix-api/README.md) and [helix-webui/README.md](helix-webui/README.md).
