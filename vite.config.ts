import { defineConfig } from "vite";

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
        index: "index.html",
        modern: "client/modern.html",
      },
    },
  },
});
