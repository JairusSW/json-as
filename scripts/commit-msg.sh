#!/usr/bin/env bash
set -euo pipefail

msg_file="${1:-}"
if [ -z "$msg_file" ] || [ ! -f "$msg_file" ]; then
  echo "commit-msg hook requires the commit message file path."
  exit 1
fi

msg="$(head -n 1 "$msg_file" | tr -d '\r')"

pattern='^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([[:alnum:]_.\/-]+\))?(!)?: .+'

if ! printf '%s\n' "$msg" | grep -Eq "$pattern"; then
  cat <<'EOF'
Commit message must follow Conventional Commits:
  <type>(optional-scope): description

Examples:
  feat: add fast path for string deserialization
  fix(json-value): retain managed refs across GC
  chore!: drop deprecated cache experiment
EOF
  exit 1
fi
