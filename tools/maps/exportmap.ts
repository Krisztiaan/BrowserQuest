// @ts-nocheck
import fs from "node:fs/promises";
import processMap from "./processmap";

const source = Bun.argv[2];
const destination = Bun.argv[3];
const mode = Bun.argv[4] || "server";

function printUsage() {
    console.log("Usage : bun ./exportmap.ts map_file json_file [mode]");
    console.log('Optional parameter : mode. Values: "server" (default) or "client".');
}

async function getTiledJSONMap(filename: string) {
    try {
        const payload = await fs.readFile(filename, "utf8");
        return JSON.parse(payload);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${filename} cannot be loaded (${message})`);
    }
}

async function main() {
    if (!source || !destination) {
        printUsage();
        process.exit(0);
    }

    const json = await getTiledJSONMap(source);
    const map = processMap(json, { mode });

    await fs.writeFile(destination, JSON.stringify(map), "utf8");
    console.log(`Finished processing map file: ${destination} was saved.`);
}

main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
});
