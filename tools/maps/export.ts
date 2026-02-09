import { DEFAULT_TILED_SOURCE_PATH, syncRuntimeMaps, type RuntimeMapTarget } from "./runtime-sync";

const modeArg = (Bun.argv[2] || "both").toLowerCase();
const sourcePath = Bun.argv[3] || DEFAULT_TILED_SOURCE_PATH;

function printUsage(): void {
    console.log("Usage : bun ./export.ts [client|server|both] [source_tiled_json_path]");
    console.log("Defaults: mode=both, source=tiled/world.json");
}

function parseTarget(value: string): RuntimeMapTarget | null {
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

    await syncRuntimeMaps({ sourcePath, target });
}

main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
});
