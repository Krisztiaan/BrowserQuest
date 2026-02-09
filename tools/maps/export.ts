import fs from "node:fs/promises";
import { exportMapFile } from "./exportmap";
import { syncWangsetArtifacts } from "./wangset";

type ExportTarget = "client" | "server" | "both";

const modeArg = (Bun.argv[2] || "both").toLowerCase();
const sourcePath = Bun.argv[3] || "tiled/world.json";

const destFiles: Record<Exclude<ExportTarget, "both">, string> = {
    client: "../../client/maps/world_client.json",
    server: "../../server/maps/world_server.json",
};

function printUsage(): void {
    console.log("Usage : bun ./export.ts [client|server|both] [source_tiled_json_path]");
    console.log("Defaults: mode=both, source=tiled/world.json");
}

function parseTarget(value: string): ExportTarget | null {
    if (value === "client" || value === "server" || value === "both") {
        return value;
    }
    return null;
}

async function main(): Promise<void> {
    const target = parseTarget(modeArg);
    if (!target) {
        printUsage();
        process.exit(1);
    }

    await fs.access(sourcePath);
    await syncWangsetArtifacts({ quiet: true });

    if (target === "both" || target === "client") {
        await exportMapFile({
            source: sourcePath,
            destination: destFiles.client,
            mode: "client",
        });
        console.log(`Finished processing map file: ${destFiles.client} was saved.`);
    }

    if (target === "both" || target === "server") {
        await exportMapFile({
            source: sourcePath,
            destination: destFiles.server,
            mode: "server",
        });
        console.log(`Finished processing map file: ${destFiles.server} was saved.`);
    }
}

main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
});
