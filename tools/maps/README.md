BrowserQuest map exporter
=========================

***Disclaimer: due to popular demand we are open sourcing this tool, but please be aware that it was never meant to be publicly released. Therefore the code is messy/non-optimized and the exporting process can be very slow with large map files.***


Editing the map
---------------

Install the Tiled editor: http://www.mapeditor.org/

Open the project file `assets/maps/tiled/browserquest.tiled-project`, then open `assets/maps/tiled/world.json` and start editing.

**Note:** there currently is no documentation on how to edit BrowserQuest-specific objects/layers in Tiled. Please refer to `assets/maps/tiled/world.json` as an example if you want to create your own map.
Project extensions are used for one-click map automation. If Tiled asks whether to enable project extensions, allow it for this project.


Using the exporter
------------------

This tool is used from the command line after saving `assets/maps/tiled/world.json` from Tiled.

**Prerequisites:**

- You need Bun installed.
- Tiled is required for interactive map editing, but not for conversion from source to runtime JSON.

**Usage:**

1. From repo root: `bun run map:export`

You can also export a single target:

- `bun run map:export:client`
- `bun run map:export:server`

Active runtime paths now consume Tiled source directly:

- Client runtime loads `assets/maps/tiled/world.json` and transforms it in-browser.
- Server runtime loads `assets/maps/tiled/world.json` and transforms it on load.
- `map:export` is optional utility output, not an active runtime prerequisite.

Terrain/Wang metadata artifacts can be refreshed explicitly:

- `bun run map:wang:sync` (from repo root)

For editor-native automapping + export in one step:

- Use *Map > BrowserQuest: AutoMap + Save + Export* (shortcut: `Ctrl+Shift+M`).
- This action runs:
  1. `autoMap()` on the active map in editor context (non-detached).
  2. Save on the active map.
  3. Runtime export (`bun run map:export`) via project command/fallback process.

**Warning:** depending on the `map JSON` filesize, the exporting process can take up to several minutes.


Things to know
--------------

The client map export writes `generated/maps/world_client.json` (optional utility output).

The client map file contains data about terrain tile layers, collision cells, doors, music areas, etc.
The server map file contains data about static entity spawning points, spawning areas, collision cells, etc.

Depending on what you want to change, it's therefore not always needed to export both maps.

**How the exporting process works:**

1. `assets/maps/tiled/world.json` is the canonical map source (plus map-local asset `assets/maps/tiled/mobset.png`).
2. `wangset.ts` derives terrain/wang metadata sidecars from terrain layer usage:
   - `assets/maps/tiled/tilesheet.wang.tsj`
   - `assets/maps/tiled/automapping.rules`
   - `assets/maps/tiled/rules/*.tmj` contains rule maps referenced by `automapping.rules`
3. `processmap.ts` converts map JSON into BrowserQuest runtime map JSON (client or server mode).
4. The processed map JSON is written to the appropriate output file.


**Known bugs:**
- No known map-exporter bugs are currently tracked in this README.
    

Contributing / Ideas for improvement
------------------------------------

Here are a few ideas for anyone who might want to help make this tool better:

- Write documentation on how to use the exporter on Windows.

- Write documentation about map editing in the Tiled editor (ie. editing BrowserQuest-specific properties of doors, chests, spawning areas, etc.)

- Write documentation about the BrowserQuest map JSON format, both for client and server map types.

- Remove hard-coded default filenames from `export.ts` in order to allow easier switching to different map files.


**Additional resources:**

- Tiled editor wiki: https://github.com/bjorn/tiled/wiki
- JSON map format documentation: https://doc.mapeditor.org/en/stable/reference/json-map-format/
