#!/usr/bin/env bash

set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo "Usage: tools/node22-run.sh <command> [args...]"
  echo "Example: tools/node22-run.sh bun run verify:modern"
  exit 1
fi

resolve_node22_bin() {
  if command -v node >/dev/null 2>&1; then
    local system_node
    local node_major
    system_node="$(command -v node)"
    node_major="$("${system_node}" -p "process.versions.node.split('.')[0]" 2>/dev/null || true)"
    if [[ "${node_major}" == "22" ]]; then
      printf '%s\n' "${system_node}"
      return 0
    fi
  fi

  if ! command -v npm >/dev/null 2>&1; then
    echo "error: npm is required to provision Node 22 when the system node is not v22" >&2
    return 1
  fi

  npm exec --yes --package=node@22 -- node -p "process.execPath"
}

NODE22_BIN="$(resolve_node22_bin)"
SHIM_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "${SHIM_DIR}"
}
trap cleanup EXIT

printf '#!/usr/bin/env bash\nexec "%s" "$@"\n' "${NODE22_BIN}" > "${SHIM_DIR}/node"
chmod +x "${SHIM_DIR}/node"

PATH="${SHIM_DIR}:${PATH}" "$@"
