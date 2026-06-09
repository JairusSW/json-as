#!/bin/bash
# Backfill versioned benchmark charts for every tagged release that doesn't
# yet have a charts/v<version>/ folder on the docs branch.
#
# For each missing tag:
#   1. Check out that tag in an isolated worktree.
#   2. Install deps (bun install).
#   3. Run the AS and JS benchmarks using whichever script layout that version had.
#   4. Build the charts.
#   5. Collect build/charts/ into a staging area.
# Then publish all new folders to the docs branch in one commit.
#
# Usage: ./scripts/backfill-benchmark-charts.sh [options] [v1.x.x ...]
#
# Options:
#   --dry-run        Print which versions would be processed; do not run.
#   --no-js          Skip the JS benchmark step for each version.
#   --keep-worktrees Leave per-version worktrees in /tmp for debugging.
#   --v8|--wavm|--llvm  Passed through to build-charts.sh (v1.3.4+ only).
#   -h, --help       Show this help and exit.
#
# Positional args: if given, only process those specific versions (e.g. v1.3.4).
# Otherwise every tagged release missing from the docs branch is processed.
#
# Environment:
#   REMOTE_NAME   Git remote to push to (default: origin).
#   DOCS_BRANCH   Branch holding the published charts (default: docs).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

REMOTE_NAME="${REMOTE_NAME:-origin}"
DOCS_BRANCH="${DOCS_BRANCH:-docs}"
DRY_RUN=0
RUN_JS=1
KEEP_WORKTREES=0
CHART_ARGS=()
EXPLICIT_VERSIONS=()

TMP_STAGING_DIR="$(mktemp -d)"   # staging/<version>/ → collected chart outputs
TMP_DOCS_DIR="$(mktemp -d)"      # worktree for the docs branch
DOCS_WORKTREE_ADDED=0
declare -a VER_WORKTREES=()       # per-version worktrees to clean up

usage() {
  cat <<'EOF'
Usage: ./scripts/backfill-benchmark-charts.sh [options] [v1.x.x ...]

Identify tagged releases without charts/v<version>/ on the docs branch, run
their benchmarks in isolated worktrees, and publish the results.

Options:
  --dry-run        Print missing versions and exit without running anything.
  --no-js          Skip the JS benchmark for each version.
  --keep-worktrees Leave per-version worktrees in place after the run (debug).
  --v8             Pass --v8 to build-charts.sh (v1.3.4+ only; default).
  --wavm           Pass --wavm to build-charts.sh.
  --llvm           Pass --llvm to build-charts.sh.
  -h, --help       Show this help and exit.

Positional args:
  v1.x.x ...  If given, only process these specific versions rather than all
              missing ones.  Must match exact git tag names.

Environment:
  REMOTE_NAME   Git remote to push to (default: origin).
  DOCS_BRANCH   Branch holding the published charts (default: docs).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)      usage; exit 0 ;;
    --dry-run)      DRY_RUN=1; shift ;;
    --no-js)        RUN_JS=0; shift ;;
    --keep-worktrees) KEEP_WORKTREES=1; shift ;;
    --v8|--wavm|--llvm) CHART_ARGS+=("$1"); shift ;;
    v*)             EXPLICIT_VERSIONS+=("$1"); shift ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

cleanup() {
  if [[ "$KEEP_WORKTREES" != "1" ]]; then
    for wt in "${VER_WORKTREES[@]+"${VER_WORKTREES[@]}"}"; do
      git worktree remove --force "$wt" >/dev/null 2>&1 || rm -rf "$wt"
    done
  else
    for wt in "${VER_WORKTREES[@]+"${VER_WORKTREES[@]}"}"; do
      echo "  kept worktree: $wt"
    done
  fi
  rm -rf "$TMP_STAGING_DIR"
  if [[ "$DOCS_WORKTREE_ADDED" == "1" ]]; then
    git worktree remove --force "$TMP_DOCS_DIR" >/dev/null 2>&1 || true
  else
    rm -rf "$TMP_DOCS_DIR"
  fi
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# 1. Determine which versions need to be backfilled
# ---------------------------------------------------------------------------
echo "Fetching remote refs..."
git fetch "$REMOTE_NAME" --tags >/dev/null 2>&1 || true
git fetch "$REMOTE_NAME" "$DOCS_BRANCH" >/dev/null 2>&1 || true

# All version tags sorted oldest-first.
ALL_TAGS=$(git tag -l 'v*' --sort=version:refname)

# Versions that already have a folder on the docs branch.
EXISTING=$(git ls-tree --name-only "refs/remotes/${REMOTE_NAME}/${DOCS_BRANCH}" charts/ 2>/dev/null \
  | grep -oP 'v[0-9]+\.[0-9]+\.[0-9]+' || true)

if [[ ${#EXPLICIT_VERSIONS[@]} -gt 0 ]]; then
  VERSIONS_TO_RUN=("${EXPLICIT_VERSIONS[@]}")
else
  VERSIONS_TO_RUN=()
  while IFS= read -r tag; do
    folder="v${tag#v}"
    if ! echo "$EXISTING" | grep -qx "$folder"; then
      VERSIONS_TO_RUN+=("$tag")
    fi
  done <<< "$ALL_TAGS"
fi

if [[ ${#VERSIONS_TO_RUN[@]} -eq 0 ]]; then
  echo "All tagged versions already have chart folders on ${DOCS_BRANCH}. Nothing to do."
  exit 0
fi

echo "Versions to backfill: ${VERSIONS_TO_RUN[*]}"

if [[ "$DRY_RUN" == "1" ]]; then
  exit 0
fi

# ---------------------------------------------------------------------------
# 2. Set up the docs worktree
# ---------------------------------------------------------------------------
echo "Setting up ${DOCS_BRANCH} worktree..."
git worktree add --detach "$TMP_DOCS_DIR" "refs/remotes/${REMOTE_NAME}/${DOCS_BRANCH}" >/dev/null
DOCS_WORKTREE_ADDED=1
(
  cd "$TMP_DOCS_DIR"
  git checkout -B "$DOCS_BRANCH" >/dev/null
)

# ---------------------------------------------------------------------------
# 3. Process each missing version
# ---------------------------------------------------------------------------
PROCESSED=()
FAILED=()

for ver in "${VERSIONS_TO_RUN[@]}"; do
  echo ""
  echo "━━━ $ver ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  VER_WORKTREE="$(mktemp -d)"
  VER_WORKTREES+=("$VER_WORKTREE")

  if ! git worktree add --detach "$VER_WORKTREE" "$ver" >/dev/null 2>&1; then
    echo "  ERROR: could not check out tag $ver — skipping." >&2
    FAILED+=("$ver")
    continue
  fi

  # Detect script layout: pre-v1.3.4 had bench scripts at root.
  if [[ -f "$VER_WORKTREE/scripts/run-bench.as.sh" ]]; then
    BENCH_AS="$VER_WORKTREE/scripts/run-bench.as.sh"
    BENCH_JS="$VER_WORKTREE/scripts/run-bench.js.sh"
    BUILD_CHARTS="$VER_WORKTREE/scripts/build-charts.sh"
  elif [[ -f "$VER_WORKTREE/run-bench.as.sh" ]]; then
    BENCH_AS="$VER_WORKTREE/run-bench.as.sh"
    BENCH_JS="$VER_WORKTREE/run-bench.js.sh"
    BUILD_CHARTS="$VER_WORKTREE/build-charts.sh"
  else
    echo "  ERROR: no run-bench.as.sh found for $ver — skipping." >&2
    FAILED+=("$ver")
    continue
  fi

  (
    cd "$VER_WORKTREE"

    echo "  Installing dependencies..."
    if ! bun install --frozen-lockfile 2>/dev/null && ! bun install 2>/dev/null; then
      echo "  WARNING: bun install failed; trying npm install..." >&2
      npm install --silent 2>/dev/null || true
    fi

    # Pin assemblyscript to the minimum version declared in package.json.
    # Between 0.28.14 and 0.28.18 the NodeKind enum gained a new entry,
    # shifting FieldDeclaration from 54→55 and MethodDeclaration from 58→59.
    # Older compiled transforms hardcode those numbers, so they generate empty
    # serializers when run with a newer compiler.  Installing the exact minimum
    # version the transform was built against keeps the IDs aligned.
    AS_MIN_VER=$(grep '"assemblyscript"' package.json 2>/dev/null \
      | grep -oP '\d+\.\d+\.\d+' | head -1 || true)
    if [[ -n "$AS_MIN_VER" ]]; then
      echo "  Pinning assemblyscript to $AS_MIN_VER for transform compatibility..."
      bun add "assemblyscript@${AS_MIN_VER}" --dev >/dev/null 2>&1 || true
    fi

    # Prepend local node_modules/.bin so tools like wasm-opt (from binaryen) are
    # found without needing a global install.
    export PATH="$VER_WORKTREE/node_modules/.bin:$PATH"

    # Older releases (pre-v1.3.8) didn't declare "json-as": "./" in devDeps,
    # so the transform can't resolve the local runtime. Create the symlink if
    # it isn't already there.
    if [[ ! -e "node_modules/json-as" ]]; then
      mkdir -p node_modules
      ln -sf "$VER_WORKTREE" "node_modules/json-as"
    fi

    echo "  Running AS benchmarks..."
    if ! bash "$BENCH_AS"; then
      echo "  ERROR: AS benchmarks failed for $ver." >&2
      exit 1
    fi

    if [[ "$RUN_JS" == "1" ]]; then
      echo "  Running JS benchmarks..."
      if ! bash "$BENCH_JS" 2>/dev/null; then
        echo "  WARNING: JS benchmarks failed for $ver — continuing without JS data." >&2
      fi
    fi

    # If JS logs are still absent (skipped or failed), copy the reference set from
    # the current repo so chart scripts can render the JS comparison bar.
    # Native JS JSON.parse/stringify performance doesn't vary across AS versions.
    REF_JS_LOGS="$(git -C "$ROOT_DIR" rev-parse --show-toplevel 2>/dev/null)/build/logs/js"
    if [[ -d "$REF_JS_LOGS" ]] && ! compgen -G "build/logs/js/*.json" >/dev/null 2>&1; then
      echo "  Copying JS reference logs from current repo for chart rendering..."
      mkdir -p build/logs/js
      cp "$REF_JS_LOGS/"*.json build/logs/js/ 2>/dev/null || true
    fi

    # Pre-v1.3.4 chart scripts used the naming convention small-str/medium-str/large-str
    # and small-obj/medium-obj/large-obj.  Create aliases so those scripts find their files.
    if [[ -d "build/logs/js" ]]; then
      declare -A _OLD_JS_MAP=(
        [small-str]=str-1kb   [medium-str]=str-500kb  [large-str]=str-1mb
        [small-obj]=obj-1kb   [medium-obj]=obj-500kb  [large-obj]=obj-1mb
      )
      for _old in "${!_OLD_JS_MAP[@]}"; do
        _new="${_OLD_JS_MAP[$_old]}"
        for _kind in serialize deserialize; do
          _src="build/logs/js/${_new}.${_kind}.js.json"
          _dst="build/logs/js/${_old}.${_kind}.js.json"
          [[ -f "$_src" && ! -f "$_dst" ]] && cp "$_src" "$_dst" || true
        done
      done
      unset _OLD_JS_MAP _old _new _kind _src _dst
    fi

    if [[ -f "$BUILD_CHARTS" ]]; then
      echo "  Building charts..."
      if [[ ${#CHART_ARGS[@]} -gt 0 ]]; then
        bash "$BUILD_CHARTS" "${CHART_ARGS[@]}" || true
      else
        bash "$BUILD_CHARTS" || true
      fi
    else
      echo "  No build-charts.sh found; running chart scripts directly..."
      mkdir -p ./build/charts
      for ts in ./scripts/build-chart*.ts; do
        [[ -f "$ts" ]] && bun "$ts" || true
      done
    fi

  ) || {
    echo "  ERROR: benchmark or chart build failed for $ver — skipping." >&2
    FAILED+=("$ver")
    continue
  }

  # Check that at least one chart was produced.
  if ! compgen -G "$VER_WORKTREE/build/charts/*" > /dev/null 2>&1; then
    echo "  ERROR: no chart files found in build/charts/ for $ver — skipping." >&2
    FAILED+=("$ver")
    continue
  fi

  # Stash the charts into staging.
  STAGE_DIR="$TMP_STAGING_DIR/$ver"
  mkdir -p "$STAGE_DIR"
  cp -R "$VER_WORKTREE/build/charts/." "$STAGE_DIR/"
  count=$(find "$STAGE_DIR" -maxdepth 1 -type f | wc -l)
  echo "  Collected $count chart files for $ver."
  PROCESSED+=("$ver")
done

# ---------------------------------------------------------------------------
# 4. Copy staged charts to the docs worktree and commit
# ---------------------------------------------------------------------------
if [[ ${#PROCESSED[@]} -eq 0 ]]; then
  echo ""
  echo "No versions were successfully benchmarked."
  [[ ${#FAILED[@]} -gt 0 ]] && echo "Failed: ${FAILED[*]}"
  exit 1
fi

echo ""
echo "Copying charts to ${DOCS_BRANCH} worktree..."
for ver in "${PROCESSED[@]}"; do
  dest="$TMP_DOCS_DIR/charts/$ver"
  rm -rf "$dest"
  mkdir -p "$dest"
  cp -R "$TMP_STAGING_DIR/$ver/." "$dest/"
done

(
  cd "$TMP_DOCS_DIR"
  git add charts/
  if git diff --cached --quiet; then
    echo "No new chart files to commit."
    exit 0
  fi

  git config user.name  "${GIT_AUTHOR_NAME:-$(git config --get user.name  2>/dev/null || echo json-as)}"
  git config user.email "${GIT_AUTHOR_EMAIL:-$(git config --get user.email 2>/dev/null || echo json-as@example.com)}"

  VERSIONS_STR=$(IFS=', '; echo "${PROCESSED[*]}")
  git commit -m "chore(charts): backfill benchmark charts for ${VERSIONS_STR} [skip ci]"
  git push "$REMOTE_NAME" "$DOCS_BRANCH"
)

echo ""
echo "Published: ${PROCESSED[*]}"
[[ ${#FAILED[@]} -gt 0 ]] && echo "Skipped (errors): ${FAILED[*]}"
echo "Done."
