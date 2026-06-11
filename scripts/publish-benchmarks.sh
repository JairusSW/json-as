#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

REMOTE_NAME="${REMOTE_NAME:-origin}"
DOCS_BRANCH="${DOCS_BRANCH:-docs}"
VERSION="$(node -p "require('./package.json').version")"
FAST_PATH="${JSON_USE_FAST_PATH:-1}"
RUN_BENCHES=1
CHART_ARGS=()
TMP_CHARTS_DIR="$(mktemp -d)"
TMP_DOCS_DIR="$(mktemp -d)"
WORKTREE_ADDED=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-run)
      RUN_BENCHES=0
      shift
      ;;
    --v8|--wavm|--llvm)
      CHART_ARGS+=("$1")
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./scripts/publish-benchmarks.sh [--no-run] [--v8|--wavm|--llvm]"
      exit 1
      ;;
  esac
done

cleanup() {
  rm -rf "$TMP_CHARTS_DIR"
  if [[ "$WORKTREE_ADDED" == "1" ]]; then
    git worktree remove --force "$TMP_DOCS_DIR" >/dev/null 2>&1 || true
  else
    rm -rf "$TMP_DOCS_DIR"
  fi
}
trap cleanup EXIT

# Publishing never commits the main working tree: it builds charts into
# ./build/charts (build output) and commits them only inside a separate `docs`
# worktree. A dirty/changed/untracked main tree is therefore safe, so proceed by
# default - charts just reflect your current (possibly uncommitted) source. Set
# PUBLISH_REQUIRE_CLEAN=1 to restore the old refuse-if-dirty guard.
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  if [[ "${PUBLISH_REQUIRE_CLEAN:-0}" == "1" ]]; then
    echo "Refusing to publish benchmarks with a dirty tracked working tree (PUBLISH_REQUIRE_CLEAN=1)."
    echo "Commit or stash your changes first."
    exit 1
  fi
  echo "⚠️  Working tree has uncommitted changes - charts will reflect them (HEAD: $(git rev-parse --short HEAD))."
fi

if [[ "$RUN_BENCHES" == "1" ]]; then
  echo "Running AssemblyScript benchmarks..."
  JSON_USE_FAST_PATH="$FAST_PATH" ./scripts/run-bench.as.sh

  echo "Running JavaScript benchmarks..."
  ./scripts/run-bench.js.sh
else
  echo "Skipping benchmark runs. Reusing existing logs."
fi

echo "Building charts..."
if [[ ${#CHART_ARGS[@]} -gt 0 ]]; then
  ./scripts/build-charts.sh "${CHART_ARGS[@]}"
else
  ./scripts/build-charts.sh
fi
test -d ./build/charts
compgen -G "./build/charts/*" > /dev/null
cp -R ./build/charts/. "$TMP_CHARTS_DIR/"

echo "Preparing ${DOCS_BRANCH} worktree..."
git fetch "$REMOTE_NAME" "$DOCS_BRANCH" >/dev/null 2>&1 || true
if git show-ref --verify --quiet "refs/remotes/${REMOTE_NAME}/${DOCS_BRANCH}"; then
  git worktree add --detach "$TMP_DOCS_DIR" "refs/remotes/${REMOTE_NAME}/${DOCS_BRANCH}" >/dev/null
  WORKTREE_ADDED=1
  (
    cd "$TMP_DOCS_DIR"
    git checkout -B "$DOCS_BRANCH" >/dev/null
  )
else
  git worktree add --detach "$TMP_DOCS_DIR" >/dev/null
  WORKTREE_ADDED=1
  (
    cd "$TMP_DOCS_DIR"
    git checkout --orphan "$DOCS_BRANCH" >/dev/null
    git rm -rf . >/dev/null 2>&1 || true
  )
fi

# Publish under charts/v<version>/ so each release keeps its own chart set.
# Re-publishing a version overwrites just that folder; other versions untouched.
DEST="v${VERSION}"
echo "Updating charts/${DEST} on ${DOCS_BRANCH}..."
rm -rf "$TMP_DOCS_DIR/charts/${DEST}"
mkdir -p "$TMP_DOCS_DIR/charts/${DEST}"
cp -R "$TMP_CHARTS_DIR/." "$TMP_DOCS_DIR/charts/${DEST}/"

(
  cd "$TMP_DOCS_DIR"
  git add -A charts
  if git diff --cached --quiet; then
    echo "No chart changes to publish for ${DEST}."
    exit 0
  fi

  git config user.name "${GIT_AUTHOR_NAME:-$(git config --get user.name || echo json-as)}"
  git config user.email "${GIT_AUTHOR_EMAIL:-$(git config --get user.email || echo json-as@example.com)}"
  git commit -m "Update benchmark charts for ${DEST} [skip ci]" >/dev/null
  git push "$REMOTE_NAME" "$DOCS_BRANCH"
)

# Re-pin the README chart <img> URLs to the version just published, so a README
# revision references the charts built from its own code. Handles both the flat
# legacy path (.../charts/<name>.svg) and an existing versioned one. Left
# uncommitted for you to review and commit.
echo "Pinning README chart URLs to charts/${DEST}/..."
sed -i -E "s#(/refs/heads/${DOCS_BRANCH}/charts/)([^\"']*/)?([^/\"']+\.(svg|png))#\1${DEST}/\3#g" README.md
# Also re-point the "Browse the full chart set" tree link to this version's
# folder (e.g. /tree/docs/charts/v1.4.0 -> /tree/docs/charts/v1.5.0). The bare
# /tree/${DOCS_BRANCH} branch link has no /charts/ segment, so it stays put.
sed -i -E "s#(/tree/${DOCS_BRANCH}/charts/)v[0-9][0-9.]*#\1${DEST}#g" README.md

echo "Benchmark charts published to ${REMOTE_NAME}/${DOCS_BRANCH}:charts/${DEST}/."
echo "README pinned to https://raw.githubusercontent.com/JairusSW/json-as/refs/heads/${DOCS_BRANCH}/charts/${DEST}/"
