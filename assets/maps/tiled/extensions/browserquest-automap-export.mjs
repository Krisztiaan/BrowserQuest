/// <reference types="@mapeditor/tiled-api" />

const ACTION_ID = "BrowserQuest.AutoMapSave";
const ACTION_TEXT = "BrowserQuest: AutoMap + Save";

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
        tiled.alert("Open a map before running BrowserQuest AutoMap + Save.", "BrowserQuest");
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

    tiled.log(`[browserquest] AutoMap + save completed for ${map.fileName}`);
});

action.text = ACTION_TEXT;
action.shortcut = "Ctrl+Shift+M";

function syncEnabledState() {
    action.enabled = activeTileMap() !== null;
}

tiled.activeAssetChanged.connect(syncEnabledState);
syncEnabledState();

tiled.extendMenu("Map", [{ action: ACTION_ID, before: "AutoMap" }]);
