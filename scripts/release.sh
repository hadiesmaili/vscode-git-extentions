#!/usr/bin/env bash
# Release a new version: bump, changelog, check, package, commit, tag, publish, push.
#
# Usage:
#   scripts/release.sh [patch|minor|major|X.Y.Z] [--dry-run] [--yes]
#
# Marketplace auth: set VSCE_PAT, or run `pnpm dlx @vscode/vsce login HadiEsmaeili` once.
# Changelog: notes under "## [Unreleased]" become the new version's notes.
# Without that section, $EDITOR opens so you can write them.
set -euo pipefail

cd "$(dirname "$0")/.."

BUMP=patch
DRY=0
YES=0
for a in "$@"; do
  case "$a" in
    patch|minor|major) BUMP=$a ;;
    [0-9]*.[0-9]*.[0-9]*) BUMP=$a ;;
    --dry-run) DRY=1 ;;
    -y|--yes) YES=1 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $a" >&2; exit 1 ;;
  esac
done

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }
confirm() {
  [ "$YES" = 1 ] && return 0
  read -r -p "$1 [y/N] " r
  [[ "$r" =~ ^[Yy]$ ]]
}

# ---- preflight ----
step "Preflight"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
[ "$BRANCH" = main ] || die "Release from main (current: $BRANCH)."
[ -z "$(git status --porcelain)" ] || die "Working tree not clean. Commit or stash first."
git fetch -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || die "main differs from origin/main. Pull or push first."

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
git rev-parse -q --verify "refs/tags/v$NEW" >/dev/null && die "Tag v$NEW already exists."
NAME=$(node -p "require('./package.json').name")
VSIX="$NAME-$NEW.vsix"
TODAY=$(date +%F)
echo "Version: $CUR -> $NEW"

if [ -z "${VSCE_PAT:-}" ] && [ "$DRY" = 0 ]; then
  pnpm dlx @vscode/vsce verify-pat HadiEsmaeili >/dev/null 2>&1 \
    || die "No Marketplace login. Set VSCE_PAT or run: pnpm dlx @vscode/vsce login HadiEsmaeili"
fi

# ---- checks first, so a failure leaves nothing changed ----
step "Typecheck and tests"
pnpm -s typecheck
pnpm -s test

# ---- version + changelog ----
step "Bump package.json and CHANGELOG.md"
node -e '
  const fs = require("fs");
  const p = JSON.parse(fs.readFileSync("package.json", "utf8"));
  p.version = process.argv[1];
  fs.writeFileSync("package.json", JSON.stringify(p, null, 2) + "\n");
' "$NEW"

if grep -q '^## \[Unreleased\]' CHANGELOG.md; then
  sed -i "s/^## \[Unreleased\].*/## [$NEW] - $TODAY/" CHANGELOG.md
else
  awk -v h="## [$NEW] - $TODAY" '
    !done && /^## \[/ { print h "\n\n### Changed\n- \n"; done = 1 }
    { print }
  ' CHANGELOG.md > CHANGELOG.md.tmp && mv CHANGELOG.md.tmp CHANGELOG.md
  "${EDITOR:-nano}" CHANGELOG.md
fi

echo
awk -v v="$NEW" '$0 ~ "^## \\[" v "\\]" {on=1; print; next} on && /^## \[/ {exit} on {print}' CHANGELOG.md

restore() {
  echo "Restoring package.json and CHANGELOG.md"
  git checkout -- package.json CHANGELOG.md
  rm -f "$VSIX"
}

# ---- package ----
step "Package $VSIX"
if ! pnpm -s package; then restore; die "Packaging failed."; fi
[ -f "$VSIX" ] || { restore; die "$VSIX not found after packaging."; }

if [ "$DRY" = 1 ]; then
  step "Dry run: built $VSIX, nothing committed or published"
  restore
  exit 0
fi

confirm "Commit, tag v$NEW, publish to Marketplace and push?" || { restore; die "Cancelled."; }

# ---- commit + tag ----
step "Commit and tag"
git add package.json CHANGELOG.md
git commit -q -m "chore(release): v$NEW"
git tag -a "v$NEW" -m "v$NEW"

# ---- publish ----
step "Publish to Marketplace"
if ! pnpm dlx @vscode/vsce publish --no-dependencies --packagePath "$VSIX"; then
  echo "Publish failed. Commit and tag stay local. Fix, then run:"
  echo "  pnpm dlx @vscode/vsce publish --no-dependencies --packagePath $VSIX && git push --follow-tags"
  exit 1
fi

# ---- push (triggers GitHub Release workflow) ----
step "Push"
git push -q --follow-tags origin main
rm -f "$VSIX"

step "Released v$NEW"
echo "Marketplace: https://marketplace.visualstudio.com/items?itemName=HadiEsmaeili.$NAME"
