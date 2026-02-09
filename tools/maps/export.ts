import fs from "node:fs/promises";
import { exportMapFile } from "./exportmap";

type ExportTarget = "client" | "server" | "both";

const modeArg = (Bun.argv[2] || "both").toLowerCase();
const sourcePath = Bun.argv[3] || "tmx/map.tmx";
const tempPath = Bun.argv[4] || ".tmp/tmx-map-export.json";

const destFiles: Record<Exclude<ExportTarget, "both">, string> = {
    client: "../../client/maps/world_client.json",
    server: "../../server/maps/world_server.json",
};

function printUsage(): void {
    console.log("Usage : bun ./export.ts [client|server|both] [source_tmx_path] [temp_json_path]");
    console.log("Defaults: mode=both, source=tmx/map.tmx, temp=.tmp/tmx-map-export.json");
}

function parseTarget(value: string): ExportTarget | null {
    if (value === "client" || value === "server" || value === "both") {
        return value;
    }
    return null;
}

async function runCommand(command: string[]): Promise<void> {
    const proc = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;

    const output = `${stdout}${stderr}`.trim();
    if (output) {
        console.log(output);
    }

    if (exitCode !== 0) {
        throw new Error(`Command failed (${exitCode}): ${command.join(" ")}`);
    }
}

async function main(): Promise<void> {
    const target = parseTarget(modeArg);
    if (!target) {
        printUsage();
        process.exit(1);
    }

    await fs.mkdir(".tmp", { recursive: true });
    await runCommand(["tiled", "--export-map", sourcePath, tempPath]);

    try {
        if (target === "both" || target === "client") {
            await exportMapFile({
                source: tempPath,
                destination: destFiles.client,
                mode: "client",
            });
            console.log(`Finished processing map file: ${destFiles.client} was saved.`);
        }

        if (target === "both" || target === "server") {
            await exportMapFile({
                source: tempPath,
                destination: destFiles.server,
                mode: "server",
            });
            console.log(`Finished processing map file: ${destFiles.server} was saved.`);
        }
    } finally {
        await fs.rm(tempPath, { force: true });
    }
}

main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
});
