import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const basePath = process.env.VITE_BASE_PATH || "/helix/";
const apiProxyTarget = process.env.VITE_API_PROXY || "http://127.0.0.1:8000";
// Host-published port when Vite runs in Docker (compose maps 5178->5173).
const hmrClientPort = Number(process.env.VITE_HMR_CLIENT_PORT || 5173);

// Fills the placeholders in public/sw.js. Dev serves the filled file on the fly
// (no precache, no asset caching so HMR works); build writes dist/sw.js with the
// unique cache name and the list of built files to precache.
// ponytail: no Workbox dependency; precache list is build output only, not public/docs PDFs.
const swSourcePath = join(import.meta.dirname, "public", "sw.js");

function fillServiceWorker(source, { precache, dev, buildId }) {
  const id = buildId ?? (dev ? "dev" : Date.now().toString(36));
  return source
    .replaceAll("__PRECACHE_URLS__", JSON.stringify(precache))
    .replaceAll("__BUILD_ID__", id)
    .replaceAll("__DEV__", String(dev));
}

function pwaServiceWorker() {
  return {
    name: "helix-pwa-service-worker",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== `${basePath}sw.js`) return next();
        res.setHeader("Content-Type", "text/javascript");
        res.setHeader("Cache-Control", "no-cache");
        res.end(fillServiceWorker(readFileSync(swSourcePath, "utf8"), { precache: [""], dev: true }));
      });
    },
    writeBundle: {
      order: "post",
      handler() {
        const outDir = "dist";
        const files = readdirSync(outDir, { recursive: true, withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => relative(outDir, join(entry.parentPath, entry.name)).split(sep).join("/"))
          .filter(
            (file) =>
              file !== "sw.js" &&
              (file === "index.html" ||
                file.startsWith("assets/") ||
                /^[^/]+\.(png|svg|webmanifest)$/.test(file)),
          );
        const swPath = join(outDir, "sw.js");
        const precache = [
          "",
          "index.html",
          ...files.filter((file) => file !== "index.html"),
        ];
        writeFileSync(
          swPath,
          fillServiceWorker(readFileSync(swSourcePath, "utf8"), { precache, dev: false }),
        );
      },
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss(), pwaServiceWorker()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: ["localhost", "127.0.0.1"],
    // Windows Docker bind mounts often miss native FS events.
    watch: {
      usePolling: true,
      interval: 2000,
      binaryInterval: 5000,
      ignored: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
    },
    hmr: {
      clientPort: hmrClientPort,
    },
    proxy: {
      [`${basePath.replace(/\/$/, "")}/api`]: {
        target: apiProxyTarget,
        changeOrigin: true,
        timeout: 600_000,
        proxyTimeout: 600_000,
        rewrite: (path) => path.replace(new RegExp(`^${basePath.replace(/\/$/, "")}/api`), "/api"),
      },
    },
  },
});



