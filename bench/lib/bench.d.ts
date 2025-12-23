/**
 * Benchmark a routine under V8.
 *
 * @param description Human-readable benchmark name
 * @param routine Function to benchmark (must be side-effect safe)
 * @param ops Number of operations to execute (default: 1,000,000)
 * @param bytesPerOp Bytes processed per operation (used for MB/s reporting)
 */
export function bench(
  description: string,
  routine: () => void,
  ops?: number,
  bytesPerOp?: number
): void;

/**
 * Prevents V8 from optimizing away a value.
 *
 * This relies on the V8 intrinsic %PerformMicrotaskCheckpoint and therefore
 * only works under d8 / V8 with --allow-natives-syntax.
 *
 * @param x Value to blackbox
 * @returns The same value
 */
export function blackbox<T>(x: T): T;
