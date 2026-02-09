import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { exportMapFile } from "./maps/exportmap";

const sourcePath = "tools/maps/tiled/world.json";
const runtimeClientPath = "client/maps/world_client.json";
const runtimeServerPath = "server/maps/world_server.json";

async function run(): Promise<void> {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bq-map-sync-"));
  const tmpClient = path.join(tmpRoot, "world_client.json");
  const tmpServer = path.join(tmpRoot, "world_server.json");

  try {
    await exportMapFile({
      source: sourcePath,
      destination: tmpClient,
      mode: "client",
      quiet: true,
    });
    await exportMapFile({
      source: sourcePath,
      destination: tmpServer,
      mode: "server",
      quiet: true,
    });

    const [expectedClient, actualClient, expectedServer, actualServer] = await Promise.all([
      fs.readFile(tmpClient, "utf8"),
      fs.readFile(runtimeClientPath, "utf8"),
      fs.readFile(tmpServer, "utf8"),
      fs.readFile(runtimeServerPath, "utf8"),
    ]);

    const driftedPaths: string[] = [];
    if (expectedClient !== actualClient) {
      driftedPaths.push(runtimeClientPath);
    }
    if (expectedServer !== actualServer) {
      driftedPaths.push(runtimeServerPath);
    }

    if (driftedPaths.length > 0) {
      console.error("map-runtime-sync-check: runtime map artifacts are out of sync:");
      for (const driftedPath of driftedPaths) {
        console.error(` - ${driftedPath}`);
      }
      console.error("Run `bun run map:export` to regenerate runtime map artifacts from tools/maps/tiled/world.json.");
      process.exit(1);
    }

    console.log("map-runtime-sync-check: ok (runtime map artifacts match canonical Tiled JSON source).");
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
}

await run();
