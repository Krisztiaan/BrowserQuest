import path from "node:path";

const repoRoot = path.resolve(import.meta.dir, "..");
const clientRoot = path.join(repoRoot, "client");
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const defaultEntry =
  process.env.BQ_CLIENT_DEFAULT_ENTRY === "index.html" ? "index.html" : "modern.html";

function safeJoin(root: string, urlPathname: string) {
  const decoded = decodeURIComponent(urlPathname);
  const normalized = path.posix.normalize(decoded);
  const withoutLeadingSlash = normalized.replace(/^\/+/, "");
  const resolved = path.resolve(root, withoutLeadingSlash);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) return null;
  return resolved;
}

const server = Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname === "/" ? `/${defaultEntry}` : url.pathname;

    // Serve the client at "/" while still allowing access to repo-level paths
    // like "/shared/...".
    const filepath =
      pathname.startsWith("/shared/") || pathname.startsWith("/client/")
        ? safeJoin(repoRoot, pathname)
        : safeJoin(clientRoot, pathname);
    if (!filepath) return new Response("Bad Request", { status: 400 });

    const file = Bun.file(filepath);
    if (!(await file.exists())) return new Response("Not Found", { status: 404 });

    const headers = new Headers();
    if (file.type) headers.set("Content-Type", file.type);
    headers.set("Cache-Control", "no-store");

    return new Response(file, { headers });
  },
});

// eslint-disable-next-line no-console
console.log(`Client: http://localhost:${server.port}`);
