BrowserQuest map exporter
=========================

***Disclaimer: due to popular demand we are open sourcing this tool, but please be aware that it was never meant to be publicly released. Therefore the code is messy/non-optimized and the exporting process can be very slow with large map files.***


Editing the map
---------------

Install the Tiled editor: http://www.mapeditor.org/

Open the canonical Tiled JSON source file `tiled/world.json` in Tiled and start editing.

**Note:** there currently is no documentation on how to edit BrowserQuest-specific objects/layers in Tiled. Please refer to `tiled/world.json` as an example if you want to create your own map.


Using the exporter
------------------

This tool is to be used from the command line after the TMX file has been saved from the Tiled editor.

Note: This tool was written with OSX in mind. If you are using a different OS (eg. Windows), additional/different steps might be required.

**Prerequisites:**

- You need Bun installed.
- Tiled is required for interactive map editing, but not for conversion from source to runtime JSON.

**Usage:**

1. `cd tools/maps/`

2. `bun ./export.ts both`

You can also export a single target:

- `bun ./export.ts client`
- `bun ./export.ts server`

For live updates while editing in Tiled:

- `bun run map:watch` (from repo root)

**Warning:** depending on the `.tmx` filesize, the exporting process can take up to several minutes.


Things to know
--------------

The client map export creates `world_client.json`.

The client map file contains data about terrain tile layers, collision cells, doors, music areas, etc.
The server map file contains data about static entity spawning points, spawning areas, collision cells, etc.

Depending on what you want to change, it's therefore not always needed to export both maps. Also, each `world_server.json` file change requires a server restart.

**How the exporting process works:**

1. `tiled/world.json` is the canonical map source (plus map-local asset `tiled/mobset.png`).
2. `processmap.ts` converts that JSON into BrowserQuest runtime map JSON (client or server mode).
3. The processed map JSON is written to the appropriate output file.


**Known bugs:**
- No known map-exporter bugs are currently tracked in this README.
    

Contributing / Ideas for improvement
------------------------------------

Here are a few ideas for anyone who might want to help make this tool better:

- Write documentation on how to use the exporter on Windows.

- Write documentation about map editing in the Tiled editor (ie. editing BrowserQuest-specific properties of doors, chests, spawning areas, etc.)

- Write documentation about the BrowserQuest map JSON format, both for client and server map types.

- Remove hard-coded default filenames from `export.ts` in order to allow easier switching to different map files.

- A complete rewrite of this tool using a custom Tiled plugin would surely be a better approach than the current one. Being able to export directly from Tiled would be much easier to use. Also, the export process is currently too slow.


**Additional resources:**

- Tiled editor wiki: https://github.com/bjorn/tiled/wiki
- TMX map format documentation: https://github.com/bjorn/tiled/wiki/TMX-Map-Format
