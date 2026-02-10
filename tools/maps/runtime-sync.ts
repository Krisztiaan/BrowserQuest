import path from "node:path";
import { fileURLToPath } from "node:url";
import { exportMapFile } from "./exportmap";
import { syncWangsetArtifacts } from "./wangset";

export type RuntimeMapTarget = "client" | "server" | "both";

export const DEFAULT_TILED_SOURCE_PATH = "../../assets/maps/tiled/world.json";

const mapsRoot = path.dirname(fileURLToPath(import.meta.url));

const runtimeDestinationRelative: Record<Exclude<RuntimeMapTarget, "both">, string> = {
    client: "../../generated/maps/world_client.json",
    server: "../../generated/maps/world_server.json",
};

const runtimeDestinations: Record<Exclude<RuntimeMapTarget, "both">, string> = {
    client: path.resolve(mapsRoot, runtimeDestinationRelative.client),
    server: path.resolve(mapsRoot, runtimeDestinationRelative.server),
};

export async function syncRuntimeMaps(params?: {
    sourcePath?: string;
    target?: RuntimeMapTarget;
    quiet?: boolean;
}): Promise<void> {
    const sourcePath = path.resolve(mapsRoot, params?.sourcePath ?? DEFAULT_TILED_SOURCE_PATH);
    const target = params?.target ?? "both";
    const quiet = params?.quiet ?? false;

    await syncWangsetArtifacts({ quiet: true });

    if (target === "both" || target === "client") {
        await exportMapFile({
            source: sourcePath,
            destination: runtimeDestinations.client,
            mode: "client",
            quiet,
        });
    }

    if (target === "both" || target === "server") {
        await exportMapFile({
            source: sourcePath,
            destination: runtimeDestinations.server,
            mode: "server",
            quiet,
        });
    }

    if (!quiet) {
        if (target === "both") {
            console.log(
                `Finished processing map file: ${runtimeDestinations.client} and ${runtimeDestinations.server} were saved.`,
            );
            return;
        }
        const destination =
            target === "client" ? runtimeDestinations.client : runtimeDestinations.server;
        console.log(`Finished processing map file: ${destination} was saved.`);
    }
}
