import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";

const includeLegacyInput = process.env.BQ_VITE_INCLUDE_LEGACY === "1";
const viteDefaultEntry =
  process.env.BQ_VITE_DEFAULT_ENTRY === "legacy"
    ? "/client/index.html"
    : "/client/modern.html";

export default defineConfig({
  root: ".",
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
      input: includeLegacyInput
        ? {
            legacy: "client/index.html",
            modern: "client/modern.html",
          }
        : {
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

        const indexJs = path.join(direct, "index.js");
        if (fs.existsSync(indexJs) && fs.statSync(indexJs).isFile()) return indexJs;

        return null;
      },
    },
    {
      name: "browserquest-copy-legacy-runtime-assets",
      apply: "build",
      closeBundle() {
        const outRoot = path.resolve("dist/vite");
        const copies: Array<[string, string]> = [
          ["client/js", "client/js"],
          ["client/maps", "client/maps"],
          ["client/audio", "client/audio"],
          ["client/img/1", "client/img/1"],
          ["client/img/2", "client/img/2"],
          ["client/img/3", "client/img/3"],
          ["client/img/common", "client/img/common"],
          ["shared/js/gametypes.js", "shared/js/gametypes.js"],
        ];

        for (const [srcRel, dstRel] of copies) {
          const src = path.resolve(srcRel);
          const dst = path.join(outRoot, dstRel);
          if (!fs.existsSync(src)) continue;
          fs.mkdirSync(path.dirname(dst), { recursive: true });
          fs.cpSync(src, dst, { recursive: true, force: true });
        }
      },
    },
  ],
});
