#!/bin/bash
set -uo pipefail

# Run the full benchmark matrix: every category, AS and JS where a JS mirror
# exists. Unlike `npm run bench` (single target + charts), this sweeps everything
# so a fresh machine can regenerate all bench logs in one shot.
#
#   Category    AS  JS   AS dir                        JS dir
#   --------    --  --   ------------------------       ----------------
#   root        ✓   ✓    assembly/__benches__/*.ts      bench/*.ts
#   multilib    ✓   ✓    assembly/__benches__/multilib  bench/multilib
#   throughput  ✓   ✓    assembly/__benches__/throughput bench/throughput
#   prim        ✓   ✓    assembly/__benches__/prim       bench/prim
#   classic     ✓   -    assembly/__benches__/classic    (AS only)
#   lazy        ✓   -    assembly/__benches__/lazy        (AS only)
#
# Any extra flags (e.g. `--mode simd`, `--v8`, `--wavm`, `--memory`) are forwarded
# to the AS runner only — the JS baseline is the engine's built-in JSON and has no
# build modes. A failing category is reported but does not abort the sweep; the
# script exits non-zero if any category failed.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

AS="./scripts/run-bench.as.sh"
JS="./scripts/run-bench.js.sh"

FAILED=()

# run <label> <command...> — print a banner, run, record (but don't abort on) failure.
run() {
  local label="$1"
  shift
  echo
  echo "═══════════════════════════════════════════════════════════════"
  echo "  $label"
  echo "═══════════════════════════════════════════════════════════════"
  if ! "$@"; then
    echo "❌ FAILED: $label" >&2
    FAILED+=("$label")
  fi
}

# AS + JS pair for a category that has both. $1 = human label, $2 = target
# ("" for root, or "dir/"). Remaining args are forwarded to the AS runner.
run_both() {
  local label="$1" target="$2"
  shift 2
  if [[ -n "$target" ]]; then
    run "$label (AS)" bash "$AS" "$target" "$@"
    run "$label (JS)" bash "$JS" "$target"
  else
    run "$label (AS)" bash "$AS" "$@"
    run "$label (JS)" bash "$JS"
  fi
}

run_both "root files" "" "$@"
run_both "multilib" "multilib/" "$@"
run_both "throughput" "throughput/" "$@"
run_both "prim" "prim/" "$@"

# AS-only categories (no JS mirror).
run "classic (AS)" bash "$AS" "classic/" "$@"
run "lazy (AS)" bash "$AS" "lazy/" "$@"

echo
echo "═══════════════════════════════════════════════════════════════"
if [[ ${#FAILED[@]} -eq 0 ]]; then
  echo "✅ All benchmark categories completed."
  exit 0
fi
echo "⚠️  ${#FAILED[@]} categor$([[ ${#FAILED[@]} -eq 1 ]] && echo "y" || echo "ies") failed:"
for f in "${FAILED[@]}"; do echo "   - $f"; done
exit 1
