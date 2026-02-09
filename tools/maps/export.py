#!/usr/bin/env python3
from pathlib import Path
import subprocess
import sys

SRC_FILE = Path("tmx/map.tmx")
TEMP_FILE = Path(f"{SRC_FILE}.json")

mode = sys.argv[1] if len(sys.argv) > 1 else "client"
if mode == "client":
    dest_file = Path("../../client/maps/world_client.json")
else:
    dest_file = Path("../../server/maps/world_server.json")


def run(cmd):
    result = subprocess.run(cmd, check=False, text=True, capture_output=True)
    output = (result.stdout or "") + (result.stderr or "")
    if output:
        print(output.strip())
    if result.returncode != 0:
        raise SystemExit(result.returncode)


# Convert the Tiled TMX file to a temporary JSON file
run(["./tmx2json.py", str(SRC_FILE), str(TEMP_FILE)])

# Map exporting
run(["bun", "./exportmap.ts", str(TEMP_FILE), str(dest_file), mode])

# Remove temporary JSON file
if TEMP_FILE.exists():
    TEMP_FILE.unlink()

# Send a Growl notification when the export process is complete (best-effort)
subprocess.run(
    [
        "growlnotify",
        "--appIcon",
        "Tiled",
        "-name",
        "Map export complete",
        "-m",
        f"{dest_file} was saved",
    ],
    check=False,
)
