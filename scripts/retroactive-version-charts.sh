#!/bin/bash
# One-time script: populate charts/v<version>/ on the docs branch from historical commits.
# Each version's folder gets the last "Update benchmark charts" commit that was pushed
# before the next release was tagged on main.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

REMOTE_NAME="${REMOTE_NAME:-origin}"
DOCS_BRANCH="${DOCS_BRANCH:-docs}"
TMP_DOCS_DIR="$(mktemp -d)"
WORKTREE_ADDED=0

cleanup() {
  if [[ "$WORKTREE_ADDED" == "1" ]]; then
    git worktree remove --force "$TMP_DOCS_DIR" >/dev/null 2>&1 || true
  else
    rm -rf "$TMP_DOCS_DIR"
  fi
}
trap cleanup EXIT

# version → last docs commit whose date falls before the next release tag on main.
# Determined by correlating `git log --format="%ai" origin/docs` with
# `git for-each-ref --sort=creatordate refs/tags` dates.
declare -A VERSION_COMMITS=(
  ["v1.2.1"]="46feec69e9878561b710ef99a23c4f9383a7be35"   # 2025-12-27, just before v1.2.2
  ["v1.2.2"]="71f8d6086e36d582b3da94484d6417d242d2c7b7"   # 2026-01-04, just before v1.2.3
  ["v1.2.3"]="426061c8e62443f97f095d2e91ac8b6b13729a00"   # 2026-01-23 06:10, just before v1.2.4
  ["v1.2.4"]="a1ee51f74c1e371df6617049ceee3aafc0084655"   # 2026-01-23 06:37, only commit in v1.2.4 era
  ["v1.2.5"]="e79a88ef5a18f0f5c29dfd6a362dcfeca1b8051f"   # 2026-02-18, just before v1.2.6
  ["v1.2.6"]="0e0dc880874f2b41301a5f3b8885c8134e550728"   # 2026-03-13, last before v1.3.0
  ["v1.3.1"]="4834a55e1189bd76a120df4c55a377b8977585de"   # 2026-04-09, last before v1.3.2
  ["v1.3.2"]="e5d1a13fd22d9675710f412340bca528f4c6b956"   # 2026-04-27, last before v1.3.3
  ["v1.3.3"]="c34a52b95bcf69a610f24d13f6e95ace309742d0"   # 2026-04-28, only commit in v1.3.3 era
  ["v1.3.9"]="51742f027b9a4abc7d18a33757445326e8e20b81"   # 2026-06-04 "Rebuild all charts" for v1.3.9
  ["v1.4.0"]="11d2ca30fedf264d4e161d5c25fe991323463fdd"   # 2026-06-05, current HEAD
)

# Ordered for the commit message (oldest first).
VERSIONS=(v1.2.1 v1.2.2 v1.2.3 v1.2.4 v1.2.5 v1.2.6 v1.3.1 v1.3.2 v1.3.3 v1.3.9 v1.4.0)

git fetch "$REMOTE_NAME" "$DOCS_BRANCH" >/dev/null 2>&1 || true

echo "Setting up ${DOCS_BRANCH} worktree..."
git worktree add --detach "$TMP_DOCS_DIR" "refs/remotes/${REMOTE_NAME}/${DOCS_BRANCH}" >/dev/null
WORKTREE_ADDED=1
(
  cd "$TMP_DOCS_DIR"
  git checkout -B "$DOCS_BRANCH" >/dev/null
)

echo "Extracting versioned chart folders..."
for ver in "${VERSIONS[@]}"; do
  commit="${VERSION_COMMITS[$ver]}"
  dest="$TMP_DOCS_DIR/charts/${ver}"
  if [[ -d "$dest" ]]; then
    echo "  $ver — already exists, skipping."
    continue
  fi
  mkdir -p "$dest"
  # Extract only the charts/ directory from the historical docs commit.
  git archive "$commit" -- charts/ 2>/dev/null \
    | tar -xC "$dest" --strip-components=1
  count=$(find "$dest" -maxdepth 1 -type f | wc -l)
  echo "  $ver ← ${commit:0:8}  ($count files)"
done

(
  cd "$TMP_DOCS_DIR"
  git add charts/
  if git diff --cached --quiet; then
    echo "No changes to commit — all versioned folders already exist."
    exit 0
  fi

  git config user.name "${GIT_AUTHOR_NAME:-$(git config --get user.name 2>/dev/null || echo json-as)}"
  git config user.email "${GIT_AUTHOR_EMAIL:-$(git config --get user.email 2>/dev/null || echo json-as@example.com)}"
  git commit -m "chore(charts): add versioned snapshot folders (v1.2.1–v1.4.0) [skip ci]"
  git push "$REMOTE_NAME" "$DOCS_BRANCH"
)

echo "Done. Versioned chart folders published to ${REMOTE_NAME}/${DOCS_BRANCH}."
