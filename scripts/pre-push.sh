#!/usr/bin/env bash
set -euo pipefail

remote_name="${1:-}"
remote_url="${2:-}"

should_run=0

while read -r local_ref local_sha remote_ref remote_sha; do
  if [[ "$remote_ref" == "refs/heads/main" ]] && [[ "$remote_url" == *"JairusSW/json-as"* ]]; then
    should_run=1
    break
  fi
done

if [[ "$should_run" -eq 0 ]]; then
  echo "Skipping full test gate: push is not targeting JairusSW/json-as main."
  exit 0
fi

echo "Push targets JairusSW/json-as main. Running full test suite..."
npm test
