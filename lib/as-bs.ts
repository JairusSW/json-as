import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
const SHRINK_EVERY_N: usize = 200;
const MIN_BUFFER_SIZE: usize = 128;

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

  let typicalSize: usize = MIN_BUFFER_SIZE;
  let counter: usize = 0;

  export let cacheOutput: usize = 0;
  export let cacheOutputLen: usize = 0;

  // @ts-ignore: decorators allowed
  @inline export function digestArena(): void {
    if (cacheOutput === 0) return;
    proposeSize(cacheOutputLen);
    memory.copy(bs.offset, cacheOutput, cacheOutputLen);
    bs.cacheOutput = 0;
  }
  /**
   * Stores the state of the buffer, allowing further changes to be reset
   */
  // @ts-ignore: decorator
  @inline export function saveState(): void {
    pauseOffset = offset;
    pauseStackSize = stackSize;
  }

  /**
   * Resets the buffer to the state it was in when `pause()` was called.
   * This allows for changes made after the pause to be discarded.
   */
  // @ts-ignore: decorator
  @inline export function loadState(): void {
    offset = pauseOffset;
    stackSize = pauseStackSize;
  }

  /**
   * Resets the buffer to the state it was in when `pause()` was called.
   * This allows for changes made after the pause to be discarded.
   */
  // @ts-ignore: decorator
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
  // @ts-ignore: decorator
  @inline export function ensureSize(size: u32): void {
    if (offset + usize(size) > bufferSize + changetype<usize>(buffer)) {
      const deltaBytes = usize(size) + MIN_BUFFER_SIZE;
      bufferSize += deltaBytes;
      // @ts-ignore: exists
      const newPtr = changetype<ArrayBuffer>(__renew(changetype<usize>(buffer), bufferSize));
      offset = offset + changetype<usize>(newPtr) - changetype<usize>(buffer);
      buffer = newPtr;
    }
  }

  /**
   * Proposes that the buffer size is should be greater than or equal to the proposed size.
   * If necessary, reallocates the buffer to the exact new size.
   * @param size - The size to propose.
   */
  // @ts-ignore: decorator
  @inline export function proposeSize(size: u32): void {
    if ((stackSize += size) > bufferSize) {
      const deltaBytes = size;
      bufferSize += deltaBytes;
      // @ts-ignore: exists
      const newPtr = changetype<ArrayBuffer>(__renew(changetype<usize>(buffer), bufferSize));
      offset = offset + changetype<usize>(newPtr) - changetype<usize>(buffer);
      buffer = newPtr;
    }
  }

  /**
   * Increases the proposed size by n + MIN_BUFFER_SIZE if necessary.
   * If necessary, reallocates the buffer to the exact new size.
   * @param size - The size to grow by.
   */
  // @ts-ignore: decorator
  @inline export function growSize(size: u32): void {
    if ((stackSize += size) > bufferSize) {
      const deltaBytes = usize(size) + MIN_BUFFER_SIZE;
      bufferSize += deltaBytes;
      // @ts-ignore
      const newPtr = changetype<ArrayBuffer>(__renew(changetype<usize>(buffer), bufferSize));
      offset = offset + changetype<usize>(newPtr) - changetype<usize>(buffer);
      buffer = newPtr;
    }
  }

  /**
   * Resizes the buffer to the specified size.
   * @param newSize - The new buffer size.
   */
  // @ts-ignore: Decorator valid here
  @inline export function resize(newSize: u32): void {
    // @ts-ignore: exists
    const newPtr = changetype<ArrayBuffer>(__renew(changetype<usize>(buffer), newSize));
    bufferSize = newSize;
    offset = changetype<usize>(newPtr);
    buffer = newPtr;
    stackSize = 0;
  }

  /**
   * Copies the buffer's content to a new object of a specified type. Does not shrink the buffer.
   * @returns The new object containing the buffer's content.
   */
  // @ts-ignore: Decorator valid here
  @inline export function cpyOut<T>(): T {
    if (pauseOffset == 0) {
      const len = offset - changetype<usize>(buffer);
      // @ts-ignore: exists
      const _out = __new(len, idof<T>());
      memory.copy(_out, changetype<usize>(buffer), len);
      return changetype<T>(_out);
    } else {
      const len = offset - pauseOffset;
      // @ts-ignore: exists
      const _out = __new(len, idof<T>());
      memory.copy(_out, pauseOffset, len);
      bs.loadState();
      return changetype<T>(_out);
    }
  }

  /**
   * Copies the buffer's content to a new object of a specified type.
   * @returns The new object containing the buffer's content.
   */
  // @ts-ignore: Decorator valid here
  export function out<T>(): T {
    let out: usize;
    if (cacheOutput === 0) {
      const len = offset - changetype<usize>(buffer);
      // @ts-ignore: exists
      out = __new(len, idof<T>());
      memory.copy(out, changetype<usize>(buffer), len);

      counter++;
      typicalSize = (typicalSize + len) >> 1;
      if (counter >= SHRINK_EVERY_N) {
        if (bufferSize > (typicalSize << 2)) resize(u32(typicalSize << 1));
        counter = 0;
      }
    } else {
      // zero-copy path
      // @ts-ignore: exists
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
  // @ts-ignore: Decorator valid here
  @inline export function view<T>(): T {
    const len = offset - changetype<usize>(buffer);
    // @ts-ignore: exists
    const _out = __new(len, idof<T>());
    memory.copy(_out, changetype<usize>(buffer), len);
    return changetype<T>(_out);
  }

  /**
   * Copies the buffer's content to a given destination pointer.
   * Optionally shrinks the buffer after copying.
   * @param dst - The destination pointer.
   * @param s - Whether to shrink the buffer after copying.
   * @returns The destination pointer cast to the specified type.
   */
  // @ts-ignore: Decorator valid here
  @inline export function outTo<T>(dst: usize): T {
    const len = offset - changetype<usize>(buffer);
    // @ts-ignore: exists
    if (len != changetype<OBJECT>(dst - TOTAL_OVERHEAD).rtSize) __renew(len, idof<T>());
    memory.copy(dst, changetype<usize>(buffer), len);

    counter++;
    typicalSize = (typicalSize + len) >> 1;

    if (counter >= SHRINK_EVERY_N) {
      if (bufferSize > (typicalSize << 2)) {
        resize(typicalSize << 1);
      }
      counter = 0;
    }

    offset = changetype<usize>(buffer);
    stackSize = 0;
    return changetype<T>(dst);
  }
}

export namespace sc {
  // @ts-ignore: decorators allowed
  @inline export const ENTRY_KEY = offsetof<sc.Entry>("key");
  // @ts-ignore: decorators allowed
  @inline export const ENTRY_PTR = offsetof<sc.Entry>("ptr");
  // @ts-ignore: decorators allowed
  @inline export const ENTRY_LEN = offsetof<sc.Entry>("len");
  // @ts-ignore: decorators allowed
  // @inline export const ENTRY_HITS = offsetof<sc.Entry>("hits");

  export const CACHE_SIZE = isDefined(JSON_CACHE) ? 4096 : 0;
  export const CACHE_MASK = CACHE_SIZE - 1;

  export const ARENA_SIZE = 1 << 20;
  export const MIN_CACHE_LEN: usize = 128;

  @unmanaged
  export class Entry {
    key!: usize;
    ptr!: usize
    len!: usize;
    // hits!: u16;
  }

  export const entries = new StaticArray<sc.Entry>(CACHE_SIZE);
  export const arena = new ArrayBuffer(ARENA_SIZE);
  export let arenaPtr: usize = changetype<usize>(arena);
  export let arenaEnd: usize = arenaPtr + ARENA_SIZE;

  // @ts-ignore: decorators allowed
  @inline
  export function indexFor(ptr: usize): usize {
    return (ptr >> 4) & CACHE_MASK;
  }

  // @ts-ignore: decorators allowed
  @inline
  export function tryEmitCached(key: usize): bool {
    const e = unchecked(entries[indexFor(key)]);
    if (e.key == key) {
      // bs.offset += e.len;
      // bs.stackSize += e.len;
      bs.cacheOutput = e.ptr;
      bs.cacheOutputLen = e.len;
      // e.hits++;
      return true;
    }
    return false;
  }

  export function insertCached(
    str: usize,
    start: usize,
    len: usize
  ): void {
    if (len < MIN_CACHE_LEN) return;
    if (arenaPtr + len > arenaEnd) {
      // wrap
      arenaPtr = changetype<usize>(arena);
    }

    memory.copy(arenaPtr, start, len);

    const e = unchecked(entries[(str >> 4) & CACHE_MASK]);
    e.key = str;
    e.ptr = arenaPtr;
    e.len = len;
    // e.hits = 1;

    arenaPtr += len;
  }
}
