import { defineConfig, loadEnv } from "vite";

function toValidPort(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const port = toValidPort(env.PORT) ?? 8123;
  const serverPort = toValidPort(env.BQ_SERVER_PORT) ?? 8000;
  const serverTargetHttp = `http://127.0.0.1:${serverPort}`;
  const serverTargetWs = `ws://127.0.0.1:${serverPort}`;

  return {
    root: ".",
    publicDir: "client/public",
    server: {
      host: true,
      port,
      strictPort: true,
      middlewareMode: false,
      proxy: {
        "/ws": {
          target: serverTargetWs,
          ws: true,
        },
        "/healthz": { target: serverTargetHttp },
        "/version": { target: serverTargetHttp },
        "/status": { target: serverTargetHttp },
        "/profile": { target: serverTargetHttp },
      },
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
  };
});
