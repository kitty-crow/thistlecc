#!/usr/bin/env bash
set -Eeuo pipefail

SOURCE="$(cd "$(dirname "$0")" && pwd)"
PROJECT="${1:-$PWD}"

while [[ "$PROJECT" != "/" ]]; do
  if [[ -f "$PROJECT/package.json" && -d "$PROJECT/.thistle" ]]; then
    break
  fi
  PROJECT="$(dirname "$PROJECT")"
done

if [[ ! -f "$PROJECT/package.json" || ! -d "$PROJECT/.thistle" ]]; then
  echo "error: could not locate the mikuOS project root" >&2
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "error: Bun is required" >&2
  exit 1
fi

cd "$SOURCE"
echo "Testing thistlecc 2.0.0 with Bun before installation..."
bun run ./test/test.ts

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
if [[ -e "$PROJECT/thistlecc" ]]; then
  mv "$PROJECT/thistlecc" "$PROJECT/thistlecc-1.x-backup-$STAMP"
fi

mkdir -p "$PROJECT/thistlecc"
tar \
  --exclude='./node_modules' \
  --exclude='./dist' \
  --exclude='./.git' \
  -cf - . | tar -xf - -C "$PROJECT/thistlecc"

chmod +x \
  "$PROJECT/thistlecc/bin/thistlecc.ts" \
  "$PROJECT/thistlecc/install-into-project.sh"

cat > "$PROJECT/thistlecc.json" <<JSON
{
  "\$schema": "./thistlecc/thistlecc.schema.json",
  "mikuosHome": ".",
  "toolchainPrefix": "riscv64-unknown-linux-musl-",
  "march": "rv64gc",
  "mabi": "lp64d",
  "outputExtension": "39",
  "reproducible": true,
  "colour": "auto"
}
JSON

cd "$PROJECT"

echo
echo "Installed thistlecc 2.0.0 at:"
echo "  $PROJECT/thistlecc"
echo
echo "Run directly:"
echo "  bun ./thistlecc/bin/thistlecc.ts --version"
echo
echo "Optional command installation:"
echo "  cd ./thistlecc && bun link"
echo
echo "Diagnostic:"
echo "  bun ./thistlecc/bin/thistlecc.ts --doctor"
