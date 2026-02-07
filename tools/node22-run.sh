#!/usr/bin/env bash

set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo "Usage: tools/node22-run.sh <command> [args...]"
  echo "Example: tools/node22-run.sh bun run verify:modern"
  exit 1
fi

NODE22_BIN="$(npx -y node@22 -p 'process.execPath')"
SHIM_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "${SHIM_DIR}"
}
trap cleanup EXIT

printf '#!/usr/bin/env bash\nexec "%s" "$@"\n' "${NODE22_BIN}" > "${SHIM_DIR}/node"
chmod +x "${SHIM_DIR}/node"

PATH="${SHIM_DIR}:${PATH}" "$@"
