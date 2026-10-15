#!/usr/bin/env bash
# Azure Linux startup entrypoint (LF line endings required)
set -euo pipefail
cd /home/site/wwwroot

# Oryx may move our deployed node_modules aside and symlink to a compressed extract
# that does not include the generated Prisma client. Restore the deploy package modules.
if [ -L node_modules ] || [ ! -d node_modules/.prisma ]; then
  if [ -d _del_node_modules ]; then
    rm -rf node_modules
    mv _del_node_modules node_modules
  fi
fi

rm -f node_modules.tar.zst oryx-manifest.toml

if [ ! -d node_modules ]; then
  echo "ERROR: node_modules missing in /home/site/wwwroot" >&2
  exit 1
fi

# Call prisma via node to avoid missing .bin shims / exit 127
node ./node_modules/prisma/build/index.js generate
exec node dist/server.js
