import { DEFAULT_TILED_SOURCE_PATH, syncRuntimeMaps, type RuntimeMapTarget } from "./runtime-sync";

const rawArgs = Bun.argv.slice(2);
const quiet = rawArgs.includes("--quiet") || rawArgs.includes("-q");
const positionalArgs = rawArgs.filter((arg) => arg !== "--quiet" && arg !== "-q");
const modeArg = (positionalArgs[0] || "both").toLowerCase();
const sourcePath = positionalArgs[1] || DEFAULT_TILED_SOURCE_PATH;

function printUsage(): void {
    console.log("Usage : bun ./export.ts [client|server|both] [source_tiled_json_path] [--quiet]");
    console.log("Defaults: mode=both, source=assets/maps/tiled/world.json");
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

    await syncRuntimeMaps({ sourcePath, target, quiet });
}

main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
});
