#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

REMOTE_NAME="${REMOTE_NAME:-origin}"
DOCS_BRANCH="${DOCS_BRANCH:-docs}"
FAST_PATH="${JSON_USE_FAST_PATH:-1}"
RUN_BENCHES=1
TMP_CHARTS_DIR="$(mktemp -d)"
TMP_DOCS_DIR="$(mktemp -d)"
WORKTREE_ADDED=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-run)
      RUN_BENCHES=0
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./scripts/publish-benchmarks.sh [--no-run]"
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

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "Refusing to publish benchmarks with a dirty tracked working tree."
  echo "Commit or stash your changes first."
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
./scripts/build-charts.sh
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
mkdir -p "$TMP_DOCS_DIR/charts"
rm -rf "$TMP_DOCS_DIR/charts"
mkdir -p "$TMP_DOCS_DIR/charts"
cp -R "$TMP_CHARTS_DIR/." "$TMP_DOCS_DIR/charts/"

(
  cd "$TMP_DOCS_DIR"
  git add charts/
  if git diff --cached --quiet; then
    echo "No chart changes to publish."
    exit 0
  fi

  git config user.name "${GIT_AUTHOR_NAME:-$(git config --get user.name || echo json-as)}"
  git config user.email "${GIT_AUTHOR_EMAIL:-$(git config --get user.email || echo json-as@example.com)}"
  git commit -m "Update benchmark charts [skip ci]" >/dev/null
  git push "$REMOTE_NAME" "$DOCS_BRANCH"
)

echo "Benchmark charts published to ${REMOTE_NAME}/${DOCS_BRANCH}."
