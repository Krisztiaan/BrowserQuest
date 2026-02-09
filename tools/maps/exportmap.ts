import fs from "node:fs/promises";
import processMap from "./processmap";

type ExportMode = "server" | "client";

function printUsage(): void {
    console.log("Usage : bun ./exportmap.ts map_file json_file [mode]");
    console.log('Optional parameter : mode. Values: "server" (default) or "client".');
}

function toMode(value: string | undefined): ExportMode {
    return value === "client" ? "client" : "server";
}

async function getTiledJSONMap(filename: string): Promise<unknown> {
    try {
        const payload = await fs.readFile(filename, "utf8");
        return JSON.parse(payload);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${filename} cannot be loaded (${message})`);
    }
}

export async function exportMapFile(params: {
    source: string;
    destination: string;
    mode: ExportMode;
    quiet?: boolean;
}): Promise<void> {
    const json = await getTiledJSONMap(params.source);
    const map = processMap(json as Parameters<typeof processMap>[0], {
        mode: params.mode,
        quiet: params.quiet,
    });
    await fs.writeFile(params.destination, JSON.stringify(map), "utf8");
}

async function main() {
    const source = Bun.argv[2];
    const destination = Bun.argv[3];
    const mode = toMode(Bun.argv[4]);

    if (!source || !destination) {
        printUsage();
        process.exit(0);
    }

    await exportMapFile({ source, destination, mode });
    console.log(`Finished processing map file: ${destination} was saved.`);
}

if (import.meta.main) {
    main().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
        process.exit(1);
    });
}
