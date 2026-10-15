#!/usr/bin/env bash
# Azure Linux startup entrypoint (must use LF line endings)
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

rm -f node_modules.tar.zst

if [ ! -d node_modules ]; then
  echo "ERROR: node_modules missing in /home/site/wwwroot" >&2
  exit 1
fi

export PATH="$PWD/node_modules/.bin:$PATH"
prisma generate
exec node dist/server.js
