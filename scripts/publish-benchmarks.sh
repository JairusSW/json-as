#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

REMOTE_NAME="${REMOTE_NAME:-origin}"
DOCS_BRANCH="${DOCS_BRANCH:-docs}"
FAST_PATH="${JSON_USE_FAST_PATH:-1}"
ALLOW_DIRTY="${ALLOW_DIRTY:-0}"
RUN_BENCHES=1
CHART_ARGS=()
TMP_CHARTS_DIR="$(mktemp -d)"
TMP_DOCS_DIR="$(mktemp -d)"
WORKTREE_ADDED=0
VERSION=$(node -p "require('./package.json').version" 2>/dev/null \
  || grep -oP '"version"\s*:\s*"\K[^"]+' package.json | head -1)

usage() {
  cat <<'EOF'
Usage: ./scripts/publish-benchmarks.sh [options]

Run the benchmarks, build the charts, and publish them to the docs branch
(as a detached worktree, so the main working tree is left untouched).

Options:
  --no-run         Skip running benchmarks; reuse existing logs.
  --allow-dirty    Publish even with uncommitted changes to tracked files.
                   (untracked files are always ignored)
  --v8             Pass --v8 through to build-charts.sh.
  --wavm           Pass --wavm through to build-charts.sh.
  --llvm           Pass --llvm through to build-charts.sh.
  -h, --help       Show this help and exit.

Environment:
  REMOTE_NAME          Git remote to push to (default: origin).
  DOCS_BRANCH          Branch to publish charts on (default: docs).
  JSON_USE_FAST_PATH   Fast-path toggle for AS benchmarks (default: 1).
  ALLOW_DIRTY          Set to 1 for the same effect as --allow-dirty.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --no-run)
      RUN_BENCHES=0
      shift
      ;;
    --allow-dirty)
      ALLOW_DIRTY=1
      shift
      ;;
    --v8|--wavm|--llvm)
      CHART_ARGS+=("$1")
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
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

if [[ "$ALLOW_DIRTY" != "1" && -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "Refusing to publish benchmarks with a dirty tracked working tree."
  echo "Commit or stash your changes first, or pass --allow-dirty (or ALLOW_DIRTY=1)."
  exit 1
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

echo "Updating charts on ${DOCS_BRANCH}..."
# Write versioned snapshot so each release keeps its own chart folder.
VERSIONED_DIR="$TMP_DOCS_DIR/charts/v${VERSION}"
rm -rf "$VERSIONED_DIR"
mkdir -p "$VERSIONED_DIR"
cp -R "$TMP_CHARTS_DIR/." "$VERSIONED_DIR/"

# Also refresh the flat chart files for any existing README/docs links.
mkdir -p "$TMP_DOCS_DIR/charts"
find "$TMP_CHARTS_DIR" -maxdepth 1 -type f | while read -r f; do
  cp "$f" "$TMP_DOCS_DIR/charts/"
done

(
  cd "$TMP_DOCS_DIR"
  git add charts/
  if git diff --cached --quiet; then
    echo "No chart changes to publish."
    exit 0
  fi

  git config user.name "${GIT_AUTHOR_NAME:-$(git config --get user.name || echo json-as)}"
  git config user.email "${GIT_AUTHOR_EMAIL:-$(git config --get user.email || echo json-as@example.com)}"
  git commit -m "chore(charts): benchmark charts for v${VERSION} [skip ci]" >/dev/null
  git push "$REMOTE_NAME" "$DOCS_BRANCH"
)

echo "Benchmark charts published to ${REMOTE_NAME}/${DOCS_BRANCH}."
