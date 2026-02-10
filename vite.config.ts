import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import { DEFAULT_TILED_SOURCE_PATH, syncRuntimeMaps } from "./tools/maps/runtime-sync";

const viteDefaultEntry = "/client/modern.html";

export default defineConfig({
  root: ".",
  publicDir: "client/public",
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    middlewareMode: false,
  },
  build: {
    outDir: "dist/vite",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        modern: "client/modern.html",
      },
    },
  },
  plugins: [
    {
      name: "browserquest-root-redirect",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === "/" || req.url === "/index.html") {
            res.statusCode = 302;
            res.setHeader("Location", viteDefaultEntry);
            res.end();
            return;
          }
          next();
        });
      },
    },
    {
      name: "browserquest-requirejs-imports",
      resolveId(source) {
        if (source.startsWith(".") || source.startsWith("/") || source.includes(":")) {
          return null;
        }
        // Keep real packages resolvable by Vite.
        if (source === "jquery") {
          return null;
        }

        const direct = path.resolve("client/js-esm", source);
        if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;

        const withJs = direct + ".js";
        if (fs.existsSync(withJs) && fs.statSync(withJs).isFile()) return withJs;

        const withTs = direct + ".ts";
        if (fs.existsSync(withTs) && fs.statSync(withTs).isFile()) return withTs;

        const indexJs = path.join(direct, "index.js");
        if (fs.existsSync(indexJs) && fs.statSync(indexJs).isFile()) return indexJs;

        const indexTs = path.join(direct, "index.ts");
        if (fs.existsSync(indexTs) && fs.statSync(indexTs).isFile()) return indexTs;

        return null;
      },
    },
    {
      name: "browserquest-map-runtime-sync-build",
      apply: "build",
      async buildStart() {
        await syncRuntimeMaps({ quiet: true });
        this.info("[map-sync] updated runtime maps (vite-build-start)");
      },
    },
    {
      name: "browserquest-map-runtime-sync",
      apply: "serve",
      configureServer(server) {
        const mapSourcePath = path.resolve("tools/maps", DEFAULT_TILED_SOURCE_PATH);
        let syncInFlight = false;
        let syncQueued = false;

        const scheduleSync = (reason: string) => {
          if (syncInFlight) {
            syncQueued = true;
            return;
          }

          syncInFlight = true;
          void (async () => {
            try {
              await syncRuntimeMaps({ quiet: true });
              server.config.logger.info(`[map-sync] updated runtime maps (${reason})`, {
                timestamp: true,
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              server.config.logger.error(`[map-sync] failed (${reason}): ${message}`);
            } finally {
              syncInFlight = false;
              if (syncQueued) {
                syncQueued = false;
                scheduleSync("queued");
              }
            }
          })();
        };

        server.watcher.add(mapSourcePath);

        server.watcher.on("change", (changedPath) => {
          if (path.resolve(changedPath) === mapSourcePath) {
            scheduleSync("map-change");
          }
        });

        scheduleSync("vite-start");
      },
    },
  ],
});
