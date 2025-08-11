import { OBJECT, TOTAL_OVERHEAD } from "rt/common";

/**
 * Central buffer namespace for managing memory operations.
 */
export namespace bs {
  /** Current buffer pointer. */ // @ts-ignore
  export let buffer: ArrayBuffer = new ArrayBuffer(128); //__new(128, idof<ArrayBuffer>());

  /** Current offset within the buffer. */
  export let offset: usize = changetype<usize>(buffer);

  /** Byte length of the buffer. */
  let bufferSize: usize = 128;

  /** Proposed size of output */
  export let stackSize: usize = 0;

  let pauseOffset: usize = 0;
  let pauseStackSize: usize = 0;

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
    // console.log("Ensure   " + (stackSize).toString() + " -> " + (stackSize + size).toString() + " (" + size.toString() + ") " + (((stackSize + size) > bufferSize) ? "+" : ""));
    if (offset + size > bufferSize + changetype<usize>(buffer)) {
      const deltaBytes = nextPowerOf2(size + 128);
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
    // console.log("Propose  " + (stackSize).toString() + " -> " + (stackSize + size).toString() + " (" + size.toString() + ") " + (((stackSize + size) > bufferSize) ? "+" : ""));
    if ((stackSize += size) > bufferSize) {
      const deltaBytes = nextPowerOf2(size);
      bufferSize += deltaBytes;
      // @ts-ignore: exists
      const newPtr = changetype<ArrayBuffer>(__renew(changetype<usize>(buffer), bufferSize));
      offset = offset + changetype<usize>(newPtr) - changetype<usize>(buffer);
      buffer = newPtr;
    }
  }

  /**
   * Increases the proposed size by nextPowerOf2(n + 128) if necessary.
   * If necessary, reallocates the buffer to the exact new size.
   * @param size - The size to grow by.
   */
  // @ts-ignore: decorator
  @inline export function growSize(size: u32): void {
    // console.log("Grow     " + (stackSize).toString() + " -> " + (stackSize + size).toString() + " (" + size.toString() + ") " + (((stackSize + size) > bufferSize) ? "+" : ""));
    if ((stackSize += size) > bufferSize) {
      const deltaBytes = nextPowerOf2(size + 128);
      bufferSize += deltaBytes;
      // @ts-ignore
      const newPtr = changetype<ArrayBuffer>(__renew(changetype<usize>(buffer), bufferSize));
      // if (buffer != newPtr) console.log("  Old: " + changetype<usize>(buffer).toString() + "\n  New: " + changetype<usize>(newPtr).toString());
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
  @inline export function out<T>(): T {
    const len = offset - changetype<usize>(buffer);
    // @ts-ignore: exists
    const _out = __new(len, idof<T>());
    memory.copy(_out, changetype<usize>(buffer), len);

    offset = changetype<usize>(buffer);
    stackSize = 0;
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

    offset = changetype<usize>(buffer);
    stackSize = 0;
    return changetype<T>(dst);
  }
}

// @ts-ignore: Decorator valid here
@inline function nextPowerOf2(n: u32): u32 {
  return 1 << (32 - clz(n - 1));
}

// @ts-ignore: Decorator valid here
@inline function bytes<T>(o: T): i32 {
  if (isInteger<T>() || isFloat<T>()) {
    return sizeof<T>();
  } else if (isManaged<T>() || isReference<T>()) {
    return changetype<OBJECT>(changetype<usize>(o) - TOTAL_OVERHEAD).rtSize;
  } else {
    throw new Error("Cannot convert type " + nameof<T>() + " to bytes!");
  }
}
