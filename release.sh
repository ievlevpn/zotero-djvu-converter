#!/usr/bin/env bash
# Cut a release: build the .xpi, add the version to updates.json, commit,
# push, and publish a GitHub release with the .xpi attached.
# Bump "version" in manifest.json (and add a "### vX.Y.Z" entry to the
# README changelog, used as release notes), then run ./release.sh
set -euo pipefail
cd "$(dirname "$0")"

REPO="ievlevpn/zotero-djvu-converter"
VER=$(node -p "require('./manifest.json').version")
XPI="build/djvu-converter-$VER.xpi"

# The README is sometimes edited on GitHub: refuse to release on a stale
# branch (a rejected push would otherwise leave the tag on the wrong commit)
git fetch -q origin
if ! git merge-base --is-ancestor origin/main HEAD; then
  echo "origin/main has commits you don't have - pull (rebase) first" >&2
  exit 1
fi
if git ls-remote --exit-code --tags origin "refs/tags/v$VER" >/dev/null; then
  echo "v$VER is already released - bump version in manifest.json first" >&2
  exit 1
fi
grep -q "^### v$VER\$" README.md || echo "warning: no '### v$VER' entry in the README changelog" >&2

node --check src/djvu-converter.js
./build.sh >/dev/null

# Add this version to updates.json (keeps older entries; their assets stay valid)
REPO="$REPO" node -e '
const fs = require("fs");
const m = require("./manifest.json");
const z = m.applications.zotero;
const feed = JSON.parse(fs.readFileSync("updates.json", "utf8"));
const updates = feed.addons[z.id].updates;
if (!updates.some(u => u.version === m.version)) {
  updates.unshift({
    version: m.version,
    update_link: `https://github.com/${process.env.REPO}/releases/download/v${m.version}/djvu-converter-${m.version}.xpi`,
    applications: { zotero: { strict_min_version: z.strict_min_version } },
  });
  fs.writeFileSync("updates.json", JSON.stringify(feed, null, 2) + "\n");
}
'

git add -A
# Skip only a genuinely empty commit - any other commit failure (hook,
# identity) must stop the release instead of publishing the old HEAD
if git diff --cached --quiet; then
  echo "(nothing to commit)"
else
  git commit -m "Release v$VER"
fi
git push origin HEAD:main
SHA=$(git rev-parse HEAD)
if [ "$(git ls-remote origin refs/heads/main | cut -f1)" != "$SHA" ]; then
  echo "origin/main is not at $SHA after push - not releasing" >&2
  exit 1
fi

# Release notes = this version's README changelog entry; if there is none,
# the commits since the previous tag (tags fetched above, so not stale)
CHANGES=$(awk -v h="### v$VER" '$0 == h { on = 1; next } on && /^##/ { exit } on' README.md | sed -e '/./,$!d')
if [ -z "$CHANGES" ]; then
  PREV=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
  RANGE=${PREV:+$PREV..HEAD}
  CHANGES=$(git log --no-merges --pretty='- %s' $RANGE | grep -v '^- Release v' || true)
fi
[ -z "$CHANGES" ] && CHANGES="- Maintenance release"

NOTES="## What's changed
$CHANGES

---
Install: download \`djvu-converter-$VER.xpi\` below → Zotero → Tools → Plugins → ⚙ → Install Plugin From File…
Existing installs update automatically."

gh release create "v$VER" "$XPI" --target "$SHA" -t "v$VER" -n "$NOTES"

echo "released v$VER"
