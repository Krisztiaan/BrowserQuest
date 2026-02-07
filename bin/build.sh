#!/usr/bin/env bash

set -euo pipefail

# Script to generate an optimized client build of BrowserQuest

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUILDDIR="${REPO_ROOT}/client-build"
PROJECTDIR="${REPO_ROOT}/client/js"
CONFIG_FILE="${REPO_ROOT}/client/config/config_build.json"
CONFIG_TEMPLATE="${REPO_ROOT}/client/config/config_build.json-dist"
TEMP_CONFIG_CREATED=0
ESM_DIR="${REPO_ROOT}/client/js-esm"
ESM_STASH_DIR=""
ESM_STASH_PATH=""

cleanup() {
  if [[ "${TEMP_CONFIG_CREATED}" -eq 1 ]]; then
    rm -f "${CONFIG_FILE}"
  fi

  if [[ -n "${ESM_STASH_PATH}" && -d "${ESM_STASH_PATH}" ]]; then
    if [[ -d "${ESM_DIR}" ]]; then
      rm -rf "${ESM_DIR}"
    fi
    mv "${ESM_STASH_PATH}" "${ESM_DIR}"
    rmdir "${ESM_STASH_DIR}" 2>/dev/null || true
  fi
}

trap cleanup EXIT

if [[ ! -f "${CONFIG_FILE}" ]]; then
  cp "${CONFIG_TEMPLATE}" "${CONFIG_FILE}"
  TEMP_CONFIG_CREATED=1
fi

if [[ -d "${ESM_DIR}" ]]; then
  ESM_STASH_DIR="$(mktemp -d "${REPO_ROOT}/.tmp-js-esm.XXXXXX")"
  ESM_STASH_PATH="${ESM_STASH_DIR}/js-esm"
  mv "${ESM_DIR}" "${ESM_STASH_PATH}"
fi


echo "Deleting previous build directory"
rm -rf "${BUILDDIR}"

echo "Building client with RequireJS"
cd "${PROJECTDIR}"
node "${REPO_ROOT}/bin/r.cjs" -o build.js

echo "Removing unnecessary js files from the build directory"
find "${BUILDDIR}/js" -type f -not \( -name "game.js" -o -name "home.js" -o -name "log.js" -o -name "require-jquery.js" -o -name "modernizr.js" -o -name "css3-mediaqueries.js" -o -name "mapworker.js" -o -name "detect.js" -o -name "underscore.min.js" -o -name "text.js" \) -delete

echo "Removing sprites directory"
rm -rf "${BUILDDIR}/sprites"

echo "Removing config directory"
rm -rf "${BUILDDIR}/config"

echo "Moving build.txt to bin directory"
mv "${BUILDDIR}/build.txt" "${SCRIPT_DIR}"

echo "Build complete"
