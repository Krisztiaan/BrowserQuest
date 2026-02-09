import { watch } from "node:fs";
import { exportMapFile } from "./exportmap";
import { syncWangsetArtifacts } from "./wangset";

const sourcePath = Bun.argv[2] || "tiled/world.json";
const clientDestination = "../../client/maps/world_client.json";
const serverDestination = "../../server/maps/world_server.json";

let exportInFlight = false;
let exportQueued = false;

async function exportBoth(): Promise<void> {
    if (exportInFlight) {
        exportQueued = true;
        return;
    }

    exportInFlight = true;
    try {
        await syncWangsetArtifacts({ quiet: true });
        await exportMapFile({
            source: sourcePath,
            destination: clientDestination,
            mode: "client",
            quiet: true,
        });
        await exportMapFile({
            source: sourcePath,
            destination: serverDestination,
            mode: "server",
            quiet: true,
        });
        console.log(`[map:watch] Exported ${clientDestination} and ${serverDestination}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[map:watch] Export failed: ${message}`);
    } finally {
        exportInFlight = false;
        if (exportQueued) {
            exportQueued = false;
            void exportBoth();
        }
    }
}

await exportBoth();

watch(sourcePath, { persistent: true }, () => {
    void exportBoth();
});

console.log(`[map:watch] Watching ${sourcePath}`);
