#!/usr/bin/env bash
# Bump the version and build a local .vsix. No commit, tag, publish or push.
#
# Usage:
#   scripts/build-vsix.sh [patch|minor|major|X.Y.Z] [--skip-checks]
#
# The new version stays in package.json. If packaging fails, it is restored.
set -euo pipefail

cd "$(dirname "$0")/.."

BUMP=patch
CHECKS=1
for a in "$@"; do
  case "$a" in
    patch|minor|major) BUMP=$a ;;
    [0-9]*.[0-9]*.[0-9]*) BUMP=$a ;;
    --skip-checks) CHECKS=0 ;;
    -h|--help) sed -n '2,7p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $a" >&2; exit 1 ;;
  esac
done

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }

CUR=$(node -p "require('./package.json').version")
if [[ "$BUMP" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  NEW=$BUMP
else
  IFS=. read -r MA MI PA <<<"$CUR"
  case "$BUMP" in
    major) NEW="$((MA + 1)).0.0" ;;
    minor) NEW="$MA.$((MI + 1)).0" ;;
    patch) NEW="$MA.$MI.$((PA + 1))" ;;
  esac
fi
NAME=$(node -p "require('./package.json').name")
VSIX="$NAME-$NEW.vsix"
echo "Version: $CUR -> $NEW"

if [ "$CHECKS" = 1 ]; then
  step "Typecheck and tests"
  pnpm -s typecheck
  pnpm -s test
fi

step "Bump package.json"
set_version() {
  node -e '
    const fs = require("fs");
    const p = JSON.parse(fs.readFileSync("package.json", "utf8"));
    p.version = process.argv[1];
    fs.writeFileSync("package.json", JSON.stringify(p, null, 2) + "\n");
  ' "$1"
}
set_version "$NEW"

step "Package $VSIX"
if ! pnpm -s package || [ ! -f "$VSIX" ]; then
  set_version "$CUR"
  die "Packaging failed. Version restored to $CUR."
fi

step "Built $VSIX"
echo "Install: code --install-extension $VSIX"
