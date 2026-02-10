import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import { DEFAULT_TILED_SOURCE_PATH, syncRuntimeMaps } from "./tools/maps/runtime-sync";

const viteDefaultEntry = "/client/modern.html";
const clientRuntimeTsconfig = JSON.parse(
  fs.readFileSync(path.resolve("tsconfig.typecheck-client-runtime.json"), "utf8"),
) as {
  compilerOptions?: {
    paths?: Record<string, string[]>;
  };
};
const clientRuntimeAliasEntries = Object.entries(clientRuntimeTsconfig.compilerOptions?.paths ?? {})
  .map(([find, replacements]) => {
    const firstReplacement = replacements[0];
    if (!firstReplacement) return null;
    return {
      find,
      replacement: path.resolve(firstReplacement),
    };
  })
  .filter((entry): entry is { find: string; replacement: string } => entry !== null);

export default defineConfig({
  root: ".",
  publicDir: "client/public",
  resolve: {
    alias: clientRuntimeAliasEntries,
  },
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
