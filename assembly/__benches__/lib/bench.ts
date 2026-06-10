import { JSON, JSONMode } from "../..";
import {
  getUsedMemorySize,
  memoryDetail,
} from "as-heap-analyzer/assembly/index";
import { bs } from "../../../lib/as-bs";

// Mirrors MEMORY_DETAIL_SIZE (default 1024) inside as-heap-analyzer. The
// package preallocates a u32-per-runtime-ID table at `memoryDetail`; we keep
// our own snapshot of it so we can diff fixture state vs post-bench state.
const HEAP_DETAIL_SLOTS: u32 = 1024;
const heapDetailSnapshot: usize = memory.data(HEAP_DETAIL_SLOTS * 4);
// @ts-ignore: decorator allowed
@external("env", "writeFile")
export declare function writeFile(fileName: string, data: string): void;

// @ts-ignore: decorator allowed
@external("env", "readFile")
export declare function readFileBuffer(filePath: string): ArrayBuffer;

// --- WASI file reading (WAVM/WASI runner) ---------------------------------
// The V8 runner supplies `env.readFile`; the WASI runner does not, so under
// WAVM we read the file through WASI (path_open + fd_read). These imports are
// only reachable when BENCH_RUNTIME_WAVM is true (a compile-time constant), so
// the V8 build tree-shakes them away and keeps a clean `env`-only import set.
// @ts-ignore: decorator allowed
@external("wasi_snapshot_preview1", "path_open")
declare function wasi_path_open(
  dirfd: u32,
  dirflags: u32,
  path: usize,
  path_len: usize,
  oflags: u32,
  rights_base: u64,
  rights_inheriting: u64,
  fdflags: u32,
  fd_out: usize,
): u32;
// @ts-ignore: decorator allowed
@external("wasi_snapshot_preview1", "fd_read")
declare function wasi_fd_read(
  fd: u32,
  iovs: usize,
  iovs_len: usize,
  nread: usize,
): u32;
// @ts-ignore: decorator allowed
@external("wasi_snapshot_preview1", "fd_filestat_get")
declare function wasi_fd_filestat_get(fd: u32, buf: usize): u32;
// @ts-ignore: decorator allowed
@external("wasi_snapshot_preview1", "fd_close")
declare function wasi_fd_close(fd: u32): u32;

// Reads a whole file via WASI, relative to the runner's preopened root
// directory (fd 3 - WAVM is invoked with `--mount-root <project root>`).
function readFileWasi(path: string): string {
  // The benches write paths as `./assembly/...`; resolve relative to the root.
  let rel = path;
  if (rel.startsWith("./")) rel = rel.substring(2);
  const pathBuf = String.UTF8.encode(rel);
  const scratch = memory.data(128);
  // WASI rights (correct bit positions): fd_read=1<<1, fd_seek=1<<2,
  // fd_tell=1<<5, fd_filestat_get=1<<21.
  const RIGHTS: u64 =
    ((<u64>1) << 1) | ((<u64>1) << 2) | ((<u64>1) << 5) | ((<u64>1) << 21);
  const err = wasi_path_open(
    3,
    1, // LOOKUPFLAGS_SYMLINK_FOLLOW
    changetype<usize>(pathBuf),
    pathBuf.byteLength,
    0, // oflags: open existing
    RIGHTS,
    RIGHTS,
    0,
    scratch, // fd_out
  );
  if (err != 0)
    throw new Error(
      "WASI path_open failed (errno " + err.toString() + ") for " + rel,
    );
  const fd = load<u32>(scratch);

  const fstat = scratch + 8; // 64-byte filestat
  if (wasi_fd_filestat_get(fd, fstat) != 0) {
    wasi_fd_close(fd);
    throw new Error("WASI fd_filestat_get failed for " + rel);
  }
  const size = <i32>load<u64>(fstat, 32); // filestat.size lives at offset 32
  const buf = new ArrayBuffer(size);
  const iovec = scratch + 80; // { buf: usize, len: usize }
  const nread = scratch + 96;
  let total = 0;
  while (total < size) {
    store<usize>(iovec, changetype<usize>(buf) + <usize>total);
    store<usize>(iovec + 4, <usize>(size - total));
    if (wasi_fd_read(fd, iovec, 1, nread) != 0) break;
    const n = <i32>load<usize>(nread);
    if (n == 0) break;
    total += n;
  }
  wasi_fd_close(fd);
  return String.UTF8.decode(buf);
}

// @ts-expect-error: AS_BENCH_RUNTIME_WAVM may be undefined.
const BENCH_RUNTIME_WAVM: bool = isDefined(AS_BENCH_RUNTIME_WAVM);
const BENCH_RUNTIME_STDOUT: bool = BENCH_RUNTIME_WAVM;


@json
class BenchResult {
  language: string = "assemblyscript";
  description!: string;
  elapsed!: f64;
  bytes!: u64;
  operations!: u64;
  features!: string[];
  nsPerOp!: f64;
  mbps!: f64;
  gbps!: f64;
  memoryBaselineBytes: u64 = 0;
  memoryPeakBytes: u64 = 0;
  memoryRetainedBytes: u64 = 0;
  memoryPostGcMs: f64 = 0;
  heapDetail: string = "";
}

// @ts-expect-error: BENCH_TRACK_MEMORY may be undefined.
const BENCH_MEMORY: bool = isDefined(BENCH_TRACK_MEMORY);

let result: BenchResult | null = null;

// 64KB per WebAssembly memory page
const WASM_PAGE_SIZE: usize = 64 * 1024;
// @ts-expect-error: BENCH_PREALLOC_BYTES may be undefined.
const PREALLOC_BYTES: usize = isDefined(BENCH_PREALLOC_BYTES)
  ? BENCH_PREALLOC_BYTES
  : 1 << 30; // 1GB
let preallocated = false;

// @ts-expect-error: @inline is a valid decorator
@inline function preallocateMemory(): void {
  if (preallocated) return;
  preallocated = true;
  if (PREALLOC_BYTES == 0) return;
  const currentPages = usize(memory.size());
  const targetPages: usize =
    (PREALLOC_BYTES + (WASM_PAGE_SIZE - 1)) / WASM_PAGE_SIZE;
  if (targetPages > currentPages) {
    // Ignore failure (memory.grow returns -1 on failure)
    memory.grow(i32(targetPages - currentPages));
  }
}

export function bench(
  description: string,
  routine: () => void,
  ops: u64 = 1_000_000,
  bytesPerOp: u64 = 0,
): void {
  preallocateMemory();
  // Run a full GC cycle before timing to reduce cross-bench noise.
  __collect();
  console.log(" - Benchmarking " + description);

  let baselineLiveBytes: u64 = 0;
  let peakPages: u64 = 0;
  let bsBaselineSize: u64 = 0;
  if (BENCH_MEMORY) {
    // getUsedMemorySize() runs __collect() then walks live blocks, populating
    // `memoryDetail` with per-runtime-ID byte totals. We snapshot it so the
    // post-bench diff filters out the fixtures (Large, Canada, u8[], …) that
    // exist before bench() ran.
    baselineLiveBytes = u64(getUsedMemorySize());
    memory.copy(heapDetailSnapshot, memoryDetail, HEAP_DETAIL_SLOTS * 4);
    peakPages = u64(memory.size());
    // `bs.bufferSize` is unmanaged (heap.alloc), so it never appears in the
    // GC-walked classDelta. Track it separately.
    bsBaselineSize = u64(bs.bufferSize);
  }

  let warmup = ops / 10;
  while (--warmup) {
    routine();
  }

  const start = performance.now();

  let count = ops;
  while (count--) {
    routine();
    if (BENCH_MEMORY) {
      const p = u64(memory.size());
      if (p > peakPages) peakPages = p;
    }
  }

  const end = performance.now();
  const elapsed = Math.max(1, end - start);

  let retainedLiveBytes: u64 = 0;
  let inflightLiveBytes: u64 = 0;
  let postGcMs: f64 = 0;
  let heapDetailJson: string = "";
  if (BENCH_MEMORY) {
    // Walk pre-GC: captures in-flight allocations the loop's incremental GC
    // hasn't reclaimed yet. memoryDetail is populated by this call; diff
    // against entry snapshot to filter fixtures.
    inflightLiveBytes = walkHeapNoCollect();
    heapDetailJson = buildHeapDetailDelta();
    // Then GC + measure retained.
    const gcStart = performance.now();
    retainedLiveBytes = u64(getUsedMemorySize());
    postGcMs = performance.now() - gcStart;
  }

  const opsPerSecond = f64(ops * 1000) / elapsed;
  const nsPerOp = (elapsed * 1_000_000) / f64(ops);

  let log = `   Completed benchmark in ${formatNumber(u64(Math.round(elapsed)))}ms at ${formatNumber(u64(Math.round(opsPerSecond)))} ops/s (${formatDurationPerOp(nsPerOp)})`;

  let mbPerSec: f64 = 0;
  if (bytesPerOp > 0) {
    const totalBytes = bytesPerOp * ops;
    mbPerSec = f64(totalBytes) / (elapsed / 1000) / (1000 * 1000);
    log += ` @ ${formatNumber(u64(Math.round(mbPerSec)))}MB/s`;
  }

  let memBaselineBytes: u64 = 0;
  let memPeakBytes: u64 = 0;
  let memRetainedBytes: u64 = 0;
  if (BENCH_MEMORY) {
    memBaselineBytes = baselineLiveBytes;
    memPeakBytes = peakPages * u64(WASM_PAGE_SIZE);
    memRetainedBytes = retainedLiveBytes;
    const grewBytes =
      memPeakBytes > memBaselineBytes ? memPeakBytes - memBaselineBytes : 0;
    // `net` is JSON-internal live retention: post-GC live minus fixture
    // baseline. Should hover at 0 for a leak-free bench regardless of fixtures.
    // `inflight` is what JSON had live at end of loop before the GC ran -
    // the working-set the routine generated on top of fixtures.
    const netDelta: i64 = i64(memRetainedBytes) - i64(memBaselineBytes);
    const inflightDelta: i64 = i64(inflightLiveBytes) - i64(memBaselineBytes);
    const bsCurrent: u64 = u64(bs.bufferSize);
    const bsDelta: i64 = i64(bsCurrent) - i64(bsBaselineSize);
    log += "\n   mem:";
    if (bytesPerOp > 0) log += ` payload=${formatBytes(bytesPerOp)}`;
    log += ` base=${formatBytes(memBaselineBytes)} peak=${formatBytes(memPeakBytes)} retained=${formatBytes(memRetainedBytes)} grew=+${formatBytes(grewBytes)} inflight=${formatBytesSigned(inflightDelta)} net=${formatBytesSigned(netDelta)} bs=${formatBytes(bsCurrent)}(${formatBytesSigned(bsDelta)}) postGC=${formatDecimal(postGcMs, 1)}ms`;
    log += "\n   heap: " + heapDetailJson;
  }

  const features: string[] = [];
  if (ASC_FEATURE_SIMD) features.push("simd");

  result = {
    language: "assemblycript",
    description,
    elapsed,
    bytes: bytesPerOp,
    operations: ops,
    features,
    nsPerOp,
    mbps: mbPerSec,
    gbps: mbPerSec / 1000,
    memoryBaselineBytes: memBaselineBytes,
    memoryPeakBytes: memPeakBytes,
    memoryRetainedBytes: memRetainedBytes,
    memoryPostGcMs: postGcMs,
    heapDetail: heapDetailJson,
  };

  console.log(log + "\n");
}

function JSON_MODE_TO_STRING(mode: JSONMode): string {
  switch (mode) {
    case JSONMode.NAIVE:
      return "naive";
    case JSONMode.SIMD:
      return "simd";
    case JSONMode.SWAR:
      return "swar";
  }
  throw new Error("Unknown mode");
}

export function dumpToFile(suite: string, type: string): void {
  const suffix = BENCH_RUNTIME_WAVM ? ".wavm.json" : ".as.json";
  const fileName =
    "./build/logs/as/" +
    JSON_MODE_TO_STRING(JSON_MODE) +
    "/" +
    suite +
    "." +
    type +
    suffix;
  const json = JSON.stringify(result);
  if (BENCH_RUNTIME_STDOUT) {
    console.log("__AS_BENCH_JSON__" + fileName + "\t" + json);
    return;
  }
  writeFile(fileName, json);
}

export function readFile(path: string): string {
  // WASI runner (WAVM): read via WASI; V8 runner: use the host `env.readFile`.
  if (BENCH_RUNTIME_WAVM) return readFileWasi(path);
  return String.UTF8.decode(readFileBuffer(path));
}

export function utf8ByteLength(value: string): usize {
  return usize(String.UTF8.byteLength(value));
}

function formatNumber(n: u64): string {
  let str = n.toString();
  let len = str.length;
  let result = "";
  let commaOffset = len % 3;
  for (let i = 0; i < len; i++) {
    if (i > 0 && (i - commaOffset) % 3 == 0) result += ",";
    result += str.charAt(i);
  }
  return result;
}

function formatDecimal(n: f64, digits: u32): string {
  const scale = i64(Math.pow(10, f64(digits)));
  const rounded = i64(Math.round(n * f64(scale)));
  const whole = rounded / scale;
  let fraction = (rounded % scale).toString();
  while (u32(fraction.length) < digits) fraction = "0" + fraction;
  return whole.toString() + "." + fraction;
}

function formatDurationPerOp(nsPerOp: f64): string {
  if (nsPerOp >= 1000) return formatDecimal(nsPerOp / 1000, 2) + " us/op";
  return formatDecimal(nsPerOp, 2) + " ns/op";
}

function formatBytes(n: u64): string {
  const KiB: u64 = 1024;
  const MiB: u64 = 1024 * 1024;
  const GiB: u64 = 1024 * 1024 * 1024;
  if (n < KiB) return n.toString() + "B";
  if (n < MiB) return formatDecimal(f64(n) / f64(KiB), 2) + "KiB";
  if (n < GiB) return formatDecimal(f64(n) / f64(MiB), 2) + "MiB";
  return formatDecimal(f64(n) / f64(GiB), 2) + "GiB";
}

function formatBytesSigned(n: i64): string {
  if (n >= 0) return "+" + formatBytes(u64(n));
  return "-" + formatBytes(u64(-n));
}

// Mirror of as-heap-analyzer's getUsedMemorySize() with the leading __collect()
// removed. We need a pre-GC snapshot to see what JSON had in flight at end of
// loop; calling the upstream variant would collect everything first and the
// per-class diff would always come out as zero.
function walkHeapNoCollect(): u64 {
  const SLOTS: u32 = HEAP_DETAIL_SLOTS;
  memory.fill(memoryDetail, 0, SLOTS * 4);
  const rootOffset: u32 = (u32(__heap_base) + 15) & ~15;
  const memStart: u32 = ((rootOffset + 1572 + 4 + 15) & ~15) - 4;
  const totalMemory: u32 = u32(memory.size()) * 64 * 1024;
  let result: u32 = memStart;
  let next: u32 = memStart;
  while (next < totalMemory - 4) {
    const currentOffset: u32 = next;
    const memoryInfo: u32 = load<u32>(currentOffset);
    const blockSize: u32 = (4 + memoryInfo) & ~3;
    next += blockSize;
    if (blockSize < 16 || currentOffset + blockSize >= totalMemory) {
      return u64(u32(-1));
    }
    if ((memoryInfo & 1) == 1) continue;
    result += blockSize;
    const objectSize: u32 = load<u32>(currentOffset, 4 * 4);
    if (objectSize + 4 * 4 > memoryInfo) continue;
    if (
      load<u32>(currentOffset, 4) == 0 &&
      load<u32>(currentOffset, 2 * 4) == 0
    )
      continue;
    const runtimeId: u32 = load<u32>(currentOffset, 3 * 4);
    if (runtimeId < SLOTS) {
      store<u32>(
        memoryDetail + runtimeId * 4,
        load<u32>(memoryDetail + runtimeId * 4) + blockSize,
      );
    }
  }
  return u64(result);
}

// Walks the snapshotted and current `memoryDetail` tables in lockstep, emitting
// only slots whose byte count changed. The snapshot was captured at bench()
// entry, so the diff is "what JSON allocated/freed during this bench."
function buildHeapDetailDelta(): string {
  let parts = "";
  let totalDelta: i64 = 0;
  let first = true;
  for (let i: u32 = 0; i < HEAP_DETAIL_SLOTS; i++) {
    const cur = load<u32>(memoryDetail + i * 4);
    const prev = load<u32>(heapDetailSnapshot + i * 4);
    if (cur == prev) continue;
    const delta: i64 = i64(cur) - i64(prev);
    totalDelta += delta;
    if (!first) parts += ",";
    parts += `"${i}":${delta}`;
    first = false;
  }
  return `{"totalDelta":${totalDelta},"classDelta":{${parts}}}`;
}

const blackBoxArea = memory.data(64);
export function blackbox<T>(value: T): T {
  store<T>(blackBoxArea, value);
  return load<T>(blackBoxArea);
}
