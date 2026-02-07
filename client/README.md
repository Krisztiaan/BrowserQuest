BrowserQuest client documentation
=================================

Local development
-----------------

From the project root:

- `bun install`
- `bun run dev`
- Open `http://localhost:3000/` (modern by default)
- Legacy compatibility entry: `http://localhost:3000/index.html`

Vite (modern tooling):

- `bun run dev:vite:full`
- Open `http://localhost:5173/` (modern default redirect)
- Explicit entries: `http://localhost:5173/client/modern.html` (ESM) or `http://localhost:5173/client/index.html` (legacy)
- Legacy default override: `BQ_VITE_DEFAULT_ENTRY=legacy bun run dev:vite:full`

Build support policy:

- Modern ESM (`client/modern.html`) is the primary supported path.
- Legacy AMD (`client/index.html`) is compatibility mode and should be changed only for parity/bugfixes.
- Full matrix and verification gates: `docs/client-build-support.md`.


The client directory should never be directly deployed to staging/production. Deployment steps:

1) Configure the websocket host/port:

In the client/config/ directory, copy config_build.json-dist to a new config_build.json file.
Edit the contents of this file to change host/port settings.

2) Run the following commands from the project root:

(Note: nodejs is required to run the build script)

* cd bin
* chmod +x build.sh
* ./build.sh

This will use the RequireJS optimizer tool to create a client-build/ directory containing a production-ready version of BrowserQuest. 

A build log file will also be created at bin/build.txt.

The client-build directory can be renamed and deployed anywhere. It has no dependencies to any other file/folder in the repository.
