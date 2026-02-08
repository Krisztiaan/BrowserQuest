import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";

const viteDefaultEntry = "/client/modern.html";

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
  ],
});
