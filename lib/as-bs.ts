import { OBJECT, TOTAL_OVERHEAD } from "rt/common";

// Buffer management constants
const SHRINK_EVERY_N: usize = 200;
const MIN_BUFFER_SIZE: usize = 128;

// Exponential moving average smoothing factor (0.0 to 1.0)
// Higher values = more responsive to recent sizes, lower = more stable
// Using 0.125 (1/8) for efficient bit-shift calculation
const EMA_ALPHA_SHIFT: usize = 3; // 1/8 = 0.125

/**
 * Central buffer namespace for managing memory operations.
 */
export namespace bs {
  /** Current buffer pointer. */
  export let buffer: ArrayBuffer = new ArrayBuffer(i32(MIN_BUFFER_SIZE));

  /** Current offset within the buffer. */
  export let offset: usize = changetype<usize>(buffer);

  /** Byte length of the buffer. */
  let bufferSize: usize = MIN_BUFFER_SIZE;

  /** Proposed size of output */
  export let stackSize: usize = 0;

  let pauseOffset: usize = 0;
  let pauseStackSize: usize = 0;

  // Exponential moving average of output sizes for adaptive buffer sizing
  // This provides smoother adaptation than simple averaging
  let typicalSize: usize = MIN_BUFFER_SIZE;
  let counter: usize = 0;

  /**
   * Updates the typical size using exponential moving average.
   * EMA formula: new_avg = alpha * new_value + (1 - alpha) * old_avg
   * Using bit shifts for efficiency: alpha = 1/8, so (1 - alpha) = 7/8
   * @param newSize - The new size to incorporate into the average
   */
  // @ts-expect-error: @inline is a valid decorator
  @inline function updateTypicalSize(newSize: usize): void {
    // EMA: typicalSize = (newSize >> 3) + typicalSize - (typicalSize >> 3)
    // Simplified: typicalSize += (newSize - typicalSize) >> 3
    typicalSize += (newSize - typicalSize) >> EMA_ALPHA_SHIFT;
  }

  export let cacheOutput: usize = 0;
  export let cacheOutputLen: usize = 0;

  // @ts-expect-error: @inline is a valid decorator
  @inline export function digestArena(): void {
    if (cacheOutput === 0) return;
    proposeSize(cacheOutputLen);
    memory.copy(bs.offset, cacheOutput, cacheOutputLen);
    bs.cacheOutput = 0;
  }
  /**
   * Stores the state of the buffer, allowing further changes to be reset
   */
  // @ts-expect-error: @inline is a valid decorator
  @inline export function saveState(): void {
    pauseOffset = offset;
    pauseStackSize = stackSize;
  }

  /**
   * Resets the buffer to the state it was in when `pause()` was called.
   * This allows for changes made after the pause to be discarded.
   */
  // @ts-expect-error: @inline is a valid decorator
  @inline export function loadState(): void {
    offset = pauseOffset;
    stackSize = pauseStackSize;
  }

  /**
   * Resets the buffer to the state it was in when `pause()` was called.
   * This allows for changes made after the pause to be discarded.
   */
  // @ts-expect-error: @inline is a valid decorator
  @inline export function resetState(): void {
    offset = pauseOffset;
    stackSize = pauseStackSize;
    pauseOffset = 0;
  }

  /**
   * Proposes that the buffer size is should be greater than or equal to the proposed size.
   * If necessary, reallocates the buffer to the exact new size.
   * @param size - The size to propose.
   */
  // @ts-expect-error: @inline is a valid decorator
  @inline export function ensureSize(size: u32): void {
    if (offset + usize(size) > bufferSize + changetype<usize>(buffer)) {
      const deltaBytes = usize(size) + MIN_BUFFER_SIZE;
      bufferSize += deltaBytes;
      // @ts-expect-error: __renew is a runtime builtin
      const newPtr = changetype<ArrayBuffer>(
        __renew(changetype<usize>(buffer), bufferSize),
      );
      offset = offset + changetype<usize>(newPtr) - changetype<usize>(buffer);
      buffer = newPtr;
    }
  }

  /**
   * Proposes that the buffer size is should be greater than or equal to the proposed size.
   * If necessary, reallocates the buffer to the exact new size.
   * @param size - The size to propose.w
   */
  // @ts-expect-error: @inline is a valid decorator
  @inline export function proposeSize(size: u32): void {
    if ((stackSize += size) > bufferSize) {
      const deltaBytes = size;
      bufferSize += deltaBytes;
      // @ts-expect-error: __renew is a runtime builtin
      const newPtr = changetype<ArrayBuffer>(
        __renew(changetype<usize>(buffer), bufferSize),
      );
      offset = offset + changetype<usize>(newPtr) - changetype<usize>(buffer);
      buffer = newPtr;
    }
  }

  /**
   * Increases the proposed size by n + MIN_BUFFER_SIZE if necessary.
   * If necessary, reallocates the buffer to the exact new size.
   * @param size - The size to grow by.
   */
  // @ts-expect-error: @inline is a valid decorator
  @inline export function growSize(size: u32): void {
    if ((stackSize += size) > bufferSize) {
      const deltaBytes = usize(size) + MIN_BUFFER_SIZE;
      bufferSize += deltaBytes;
      // @ts-expect-error: __renew is a runtime builtin
      const newPtr = changetype<ArrayBuffer>(
        __renew(changetype<usize>(buffer), bufferSize),
      );
      offset = offset + changetype<usize>(newPtr) - changetype<usize>(buffer);
      buffer = newPtr;
    }
  }

  /**
   * Resizes the buffer to the specified size.
   * @param newSize - The new buffer size.
   */
  // @ts-expect-error: @inline is a valid decorator
  @inline export function resize(newSize: u32): void {
    // @ts-expect-error: __renew is a runtime builtin
    const newPtr = changetype<ArrayBuffer>(
      __renew(changetype<usize>(buffer), newSize),
    );
    bufferSize = newSize;
    offset = changetype<usize>(newPtr);
    buffer = newPtr;
    stackSize = 0;
  }

  /**
   * Copies the buffer's content to a new object of a specified type. Does not shrink the buffer.
   * @returns The new object containing the buffer's content.
   */
  // @ts-expect-error: @inline is a valid decorator
  @inline export function cpyOut<T>(): T {
    if (pauseOffset == 0) {
      const len = offset - changetype<usize>(buffer);
      // @ts-expect-error: __new is a runtime builtin
      const _out = __new(len, idof<T>());
      memory.copy(_out, changetype<usize>(buffer), len);
      return changetype<T>(_out);
    } else {
      const len = offset - pauseOffset;
      // @ts-expect-error: __new is a runtime builtin
      const _out = __new(len, idof<T>());
      memory.copy(_out, pauseOffset, len);
      bs.loadState();
      return changetype<T>(_out);
    }
  }

  /**
   * Copies the buffer's content to a new object of a specified type.
   * Uses exponential moving average to track typical output sizes for
   * adaptive buffer management - shrinks buffer when consistently oversized.
   * @returns The new object containing the buffer's content.
   */
  // @ts-expect-error: @inline is a valid decorator
  @inline export function out<T>(): T {
    let out: usize;
    if (cacheOutput === 0) {
      const len = offset - changetype<usize>(buffer);
      // @ts-expect-error: __new is a runtime builtin
      out = __new(len, idof<T>());
      memory.copy(out, changetype<usize>(buffer), len);

      counter++;
      // Use exponential moving average for smoother size tracking
      updateTypicalSize(len);
      if (counter >= SHRINK_EVERY_N) {
        // Shrink if buffer is 4x larger than typical, resize to 2x typical
        if (bufferSize > typicalSize << 2) resize(u32(typicalSize << 1));
        counter = 0;
      }
    } else {
      // zero-copy path
      // @ts-expect-error: __new is a runtime builtin
      out = __new(cacheOutputLen, idof<T>());
      memory.copy(out, cacheOutput, cacheOutputLen);
      // reset arena flag
      cacheOutput = 0;
    }

    offset = changetype<usize>(buffer);
    stackSize = 0;
    return changetype<T>(out);
  }

  /**
   * Copies the buffer's content to a new object of a specified type.
   * @returns The new object containing the buffer's content.
   */
  // @ts-expect-error: @inline is a valid decorator
  @inline export function view<T>(): T {
    const len = offset - changetype<usize>(buffer);
    // @ts-expect-error: __new is a runtime builtin
    const _out = __new(len, idof<T>());
    memory.copy(_out, changetype<usize>(buffer), len);
    return changetype<T>(_out);
  }

  /**
   * Copies the buffer's content to a given destination pointer.
   * Uses exponential moving average for adaptive buffer sizing.
   * @param dst - The destination pointer.
   * @returns The destination pointer cast to the specified type.
   */
  // @ts-expect-error: @inline is a valid decorator
  @inline export function outTo<T>(dst: usize): T {
    const len = offset - changetype<usize>(buffer);
    // @ts-expect-error: __renew is a runtime builtin
    if (len != changetype<OBJECT>(dst - TOTAL_OVERHEAD).rtSize)
      __renew(len, idof<T>());
    memory.copy(dst, changetype<usize>(buffer), len);

    counter++;
    // Use exponential moving average for smoother size tracking
    updateTypicalSize(len);

    if (counter >= SHRINK_EVERY_N) {
      // Shrink if buffer is 4x larger than typical, resize to 2x typical
      if (bufferSize > typicalSize << 2) {
        resize(typicalSize << 1);
      }
      counter = 0;
    }

    offset = changetype<usize>(buffer);
    stackSize = 0;
    return changetype<T>(dst);
  }
}

/**
 * String Caching (sc) namespace for optimizing repeated string serialization.
 *
 * This caching system can significantly boost performance when serializing
 * objects with repeated string values. When enabled, serialized strings are
 * cached and reused on subsequent serializations of the same string reference.
 *
 * ## Configuration
 *
 * Enable caching by setting the `JSON_CACHE` environment variable:
 * ```bash
 * JSON_CACHE=1 npx asc your-file.ts --transform json-as/transform
 * ```
 *
 * ## Memory Configuration
 *
 * The cache uses the following fixed memory allocations:
 *
 * - **CACHE_SIZE** (4096 entries): Number of cache slots. Uses direct-mapped
 *   caching with pointer-based indexing. Collisions will evict previous entries.
 *   Memory usage: ~49KB (4096 * 12 bytes per entry)
 *
 * - **ARENA_SIZE** (1MB): Circular buffer for storing cached serialized strings.
 *   When full, wraps around and overwrites oldest entries. Larger values retain
 *   more cached data but consume more memory.
 *
 * - **MIN_CACHE_LEN** (128 bytes): Minimum serialized output size to cache.
 *   Smaller outputs aren't cached as the overhead isn't worth it.
 *   Only strings producing outputs >= 128 bytes are cached.
 *
 * ## Trade-offs
 *
 * - **Memory**: ~1.05MB fixed overhead when enabled (arena + entry table)
 * - **Best for**: Applications serializing the same string references repeatedly
 * - **Not ideal for**: One-time serializations or highly unique string content
 *
 * ## Performance
 *
 * When effective, caching can achieve >22 GB/s serialization throughput by
 * avoiding re-serialization of previously seen strings.
 */
export namespace sc {
  // @ts-expect-error: @inline is a valid decorator
  @inline export const ENTRY_KEY = offsetof<sc.Entry>("key");
  // @ts-expect-error: @inline is a valid decorator
  @inline export const ENTRY_PTR = offsetof<sc.Entry>("ptr");
  // @ts-expect-error: @inline is a valid decorator
  @inline export const ENTRY_LEN = offsetof<sc.Entry>("len");

  /** Number of cache slots (power of 2 for efficient masking). Set to 0 when caching disabled. */
  // @ts-expect-error: JSON_CACHE may not be defined. If so, it will default to 0.
  export const CACHE_SIZE = isDefined(JSON_CACHE) ? 1024 : 0;
  /** Bitmask for fast modulo operation on cache index */
  export const CACHE_MASK = CACHE_SIZE - 1;

  /** Size of the circular arena buffer for cached strings (1MB) */
  export const ARENA_SIZE = 1 << 20;
  /** Minimum serialized length to cache - smaller outputs aren't worth caching */
  export const MIN_CACHE_LEN: usize = 128;

  /** Cache entry structure - stores pointer to string, cached output location, and length */
  @unmanaged
  export class Entry {
    /** Original string pointer (used as cache key) */
    key!: usize;
    /** Pointer to cached serialized output in arena */
    ptr!: usize;
    /** Length of cached serialized output */
    len!: usize;
  }

  /** Static array of cache entries */
  export const entries = new StaticArray<sc.Entry>(CACHE_SIZE);
  /** Circular buffer arena for storing cached serialized strings */
  export const arena = new ArrayBuffer(ARENA_SIZE);
  /** Current write position in the arena */
  export let arenaPtr: usize = changetype<usize>(arena);
  /** End boundary of the arena */
  export let arenaEnd: usize = arenaPtr + ARENA_SIZE;

  /**
   * Computes cache index for a given string pointer.
   * Uses pointer address shifted right by 4 bits (aligned to 16-byte boundaries)
   * masked to fit within cache size.
   */
  // @ts-expect-error: @inline is a valid decorator
  @inline
  export function indexFor(ptr: usize): usize {
    return (ptr >> 4) & CACHE_MASK;
  }

  /**
   * Attempts to retrieve a cached serialization for the given string pointer.
   * If found, sets up the buffer system to use the cached output.
   * @param key - The string pointer to look up
   * @returns true if cache hit, false if cache miss
   */
  // @ts-expect-error: @inline is a valid decorator
  @inline
  export function tryEmitCached(key: usize): bool {
    const e = unchecked(entries[indexFor(key)]);
    if (e.key == key) {
      bs.cacheOutput = e.ptr;
      bs.cacheOutputLen = e.len;
      return true;
    }
    return false;
  }

  /**
   * Stores a serialized string output in the cache for future reuse.
   * Only caches outputs >= MIN_CACHE_LEN bytes to avoid overhead for small strings.
   * Uses a circular arena buffer - when full, wraps around and overwrites oldest data.
   * @param str - Original string pointer (used as cache key)
   * @param start - Start of serialized output to cache
   * @param len - Length of serialized output
   */
  export function insertCached(str: usize, start: usize, len: usize): void {
    if (len < MIN_CACHE_LEN) return;
    if (arenaPtr + len > arenaEnd) {
      // Wrap around to beginning of arena (circular buffer)
      arenaPtr = changetype<usize>(arena);
    }

    memory.copy(arenaPtr, start, len);

    const e = unchecked(entries[i32((str >> 4) & CACHE_MASK)]);
    e.key = str;
    e.ptr = arenaPtr;
    e.len = len;

    arenaPtr += len;
  }
}
