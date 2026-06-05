import { JSON } from ".";

// Fast-path (non-lazy, eager) deserialize micro-bench. Edit the generated
// assembly/playground.tmp.ts to hand-tune __DESERIALIZE_FAST, then:
//   bun run build:playground      # regenerate tmp (runs the transform)
//   bun run playground:tmp        # build + run the tmp WITHOUT the transform

@json
class Obj {
  id: u32 = 0;
  active: boolean = false;
  name: string = "";
  email: string = "";
  role: string = "";
  count: i32 = 0;
  score: f64 = 0;
  created: string = "";
}

// @inline so the call site is exactly what the throughput benches emit: a
// direct __DESERIALIZE_FAST into a reused `out`, no per-op allocation.
// @ts-expect-error: @inline is a valid decorator here
@inline function deserializeInto<T>(
  srcStart: usize,
  srcEnd: usize,
  out: T,
): void {
  // @ts-ignore: supplied by transform
  if (isDefined(out.__DESERIALIZE_FAST)) {
    // @ts-ignore: supplied by transform
    out.__DESERIALIZE_FAST(srcStart, srcEnd, out);
    return;
  }
  // @ts-ignore: supplied by transform
  out.__DESERIALIZE_SLOW(srcStart, srcEnd, out);
}

const json = `{"id":4294967295,"active":true,"name":"jairus tanaka","email":"me@jairus.dev","role":"administrator","count":-123456,"score":3.1415926535,"created":"2025-01-02T03:04:05Z"}`;
const srcStart = changetype<usize>(json);
const srcEnd = srcStart + ((<usize>json.length) << 1);
const bytes = <f64>String.UTF8.byteLength(json);

const out = new Obj();

// Correctness check before timing.
deserializeInto<Obj>(srcStart, srcEnd, out);
console.log("re-serialized: " + JSON.stringify(out));

// Report the MIN ns/op across many rounds — the least-noisy estimator of the
// underlying cost (scheduler/CPU-frequency noise only ever makes a round
// slower, never faster).
function timeit(label: string, iters: i32, rounds: i32): void {
  // warmup
  let w = iters;
  while (w-- > 0) deserializeInto<Obj>(srcStart, srcEnd, out);

  let bestNs = Infinity;
  let r = rounds;
  while (r-- > 0) {
    const start = performance.now();
    let i = iters;
    while (i-- > 0) deserializeInto<Obj>(srcStart, srcEnd, out);
    const elapsed = Math.max(0.0001, performance.now() - start);
    const nsPerOp = (elapsed * 1.0e6) / <f64>iters;
    if (nsPerOp < bestNs) bestNs = nsPerOp;
  }

  console.log(
    label +
      ":  best " +
      bestNs.toString() +
      " ns/op   " +
      ((bytes / bestNs) * 1.0e3).toString() +
      " MB/s   (" +
      iters.toString() +
      " ops x " +
      rounds.toString() +
      " rounds)",
  );
}

const ITERS = 2_000_000;
timeit("deser Obj", ITERS, 12);
