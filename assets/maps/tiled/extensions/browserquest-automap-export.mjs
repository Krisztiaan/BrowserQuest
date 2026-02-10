/// <reference types="@mapeditor/tiled-api" />

const ACTION_ID = "BrowserQuest.AutoMapSaveExport";
const ACTION_TEXT = "BrowserQuest: AutoMap + Save + Export";
const EXPORT_COMMAND_NAME = "BrowserQuest: Export Runtime Map JSON";

function projectRootPath() {
    const projectFile = tiled.project.fileName;
    if (!projectFile) {
        return "";
    }
    const projectDir = FileInfo.path(projectFile);
    return FileInfo.cleanPath(FileInfo.joinPaths(projectDir, "..", "..", ".."));
}

function runExportFallback() {
    const rootPath = projectRootPath();
    if (!rootPath) {
        tiled.alert("No Tiled project is open. Open browserquest.tiled-project first.", "BrowserQuest");
        return false;
    }

    const process = new Process();
    process.workingDirectory = rootPath;

    let exitCode = -1;
    try {
        exitCode = process.exec("bun", ["run", "map:export"], false);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        tiled.alert(`Failed to run Bun export fallback:\n${message}`, "BrowserQuest");
        process.close();
        return false;
    }

    const stdout = process.readStdOut().trim();
    const stderr = process.readStdErr().trim();
    process.close();

    if (stdout) {
        tiled.log(stdout);
    }
    if (stderr) {
        tiled.warn(stderr);
    }

    if (exitCode !== 0) {
        tiled.alert(`Bun export failed (exit code ${exitCode}). See Console for details.`, "BrowserQuest");
        return false;
    }
    return true;
}

function runRuntimeExport() {
    try {
        tiled.executeCommand(EXPORT_COMMAND_NAME, false);
        return true;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        tiled.warn(`[browserquest] ${EXPORT_COMMAND_NAME} is unavailable (${message}). Falling back to Process.exec.`);
        return runExportFallback();
    }
}

function activeTileMap() {
    const asset = tiled.activeAsset;
    if (!asset || !asset.isTileMap) {
        return null;
    }
    return asset;
}

const action = tiled.registerAction(ACTION_ID, () => {
    const map = activeTileMap();
    if (!map) {
        tiled.alert("Open a map before running BrowserQuest AutoMap + Save + Export.", "BrowserQuest");
        return;
    }

    if (!map.fileName) {
        tiled.alert("The map needs to be saved to disk before AutoMap can run.", "BrowserQuest");
        return;
    }

    try {
        map.autoMap();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        tiled.alert(`Automapping failed:\n${message}`, "BrowserQuest");
        return;
    }

    if (!map.save()) {
        tiled.alert("Automapping completed, but the map could not be saved.", "BrowserQuest");
        return;
    }

    if (!runRuntimeExport()) {
        return;
    }

    tiled.log(`[browserquest] AutoMap + save + runtime export completed for ${map.fileName}`);
});

action.text = ACTION_TEXT;
action.shortcut = "Ctrl+Shift+M";

function syncEnabledState() {
    action.enabled = activeTileMap() !== null;
}

tiled.activeAssetChanged.connect(syncEnabledState);
syncEnabledState();

tiled.extendMenu("Map", [{ action: ACTION_ID, before: "AutoMap" }]);
