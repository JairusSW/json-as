// Malformed-range failures are recorded only on the cold error path and
// consumed at a public JSON.parse boundary. Keeping the final throw there
// makes it catchable by try-as without adding a success-path store or a
// second validation scan.
let productionParseError = false;

export function markProductionParseError(): void {
  productionParseError = true;
}

export function takeProductionParseError(): bool {
  if (!productionParseError) return false;
  productionParseError = false;
  return true;
}

/** Mark a malformed cold path and return the shared zero cursor sentinel. */
export function failProductionParse(): usize {
  productionParseError = true;
  return 0;
}
