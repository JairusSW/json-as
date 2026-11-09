// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import * as runtime from "rt/common";

// Published runtimes do not reserve string metadata or expose allocation hints.
// Keep those optimizations optional so the library also works with stable AS.
export const STRING_SIZE_MASK: u32 = isDefined(runtime.STRING_SIZE_MASK)
  ? runtime.STRING_SIZE_MASK
  : u32.MAX_VALUE;
export const STRING_METADATA_MASK: u32 = isDefined(runtime.STRING_METADATA_MASK)
  ? runtime.STRING_METADATA_MASK
  : 0;


@inline
export function allocateUninitialized(size: usize, id: u32): usize {
  if (isDefined(__newUninitialized)) return __newUninitialized(size, id);
  return __new(size, id);
}

// The transform specializes this library-owned allocation entry without
// rewriting application calls or changing the allocator's GC semantics.
@inline
export function allocateObject(size: usize, id: u32): usize {
  return __new(size, id);
}

// Generated readers keep this clear unless their actual allocation entry is
// verified to zero the full payload. Other runtimes retain their normal clear.
@inline
export function clearAllocatedObject(ptr: usize, size: usize): void {
  memory.fill(ptr, 0, size);
}

// Enabled only after the transform recognizes the installed allocator. Callers
// preserve their original allocation/publication order under instrumentation.
@inline
export function canAllocateCopiedString(): bool {
  return false;
}

/** Internal factory: the returned string payload is fully initialized. */
@inline
export function allocateCopiedString(source: usize, size: usize): usize {
  const out = allocateObject(size, idof<string>());
  memory.copy(out, source, size);
  return out;
}

// Library-owned pointer publication. Other runtimes retain their own barrier;
// the transform can inline the installed incremental implementation here.
@inline
export function linkObject(parent: usize, child: usize, expectMultiple: bool = false): void {
  __link(parent, child, expectMultiple);
}

// One unfinished batch per native small-block size, or one mixed-size stream
// when the matching collector specialization is available. Each piece gets
// its own ordinary managed header and is reclaimed by the standard runtime.
// The unassigned tails remain raw allocator storage, not managed objects.
// @ts-expect-error: @lazy is a valid decorator
@lazy const SMALL_BLOCK_HEADS: usize = memory.data(9 * sizeof<usize>(), 16);

/** Enabled together with the matching library-owned collector entry. */
@inline
export function canCoalesceSweepRuns(): bool {
  return false;
}

/** Internal backing allocator used only by the transformed incremental entry. */
@inline
export function allocateSmallBlock(size: usize): usize {
  const mixed = canCoalesceSweepRuns();
  // Preserve the native physical-block event stream when RTrace is enabled.
  if (
    sizeof<usize>() == 4 &&
    !isDefined(ASC_RTRACE) &&
    size <= (mixed ? 508 : 124)
  ) {
    const payload =
      ((size + runtime.BLOCK_OVERHEAD + runtime.AL_MASK) & ~runtime.AL_MASK) -
      runtime.BLOCK_OVERHEAD;
    const span = payload + runtime.BLOCK_OVERHEAD;
    const slot = mixed
      ? SMALL_BLOCK_HEADS + sizeof<usize>()
      : SMALL_BLOCK_HEADS + ((span >> runtime.AL_BITS) << alignof<usize>());
    let ptr = load<usize>(slot);
    // A mixed stream can end with a tail smaller than its next request.
    if (
      mixed &&
      ptr &&
      (load<usize>(ptr - runtime.BLOCK_OVERHEAD) & ~(<usize>3)) < payload
    ) {
      store<usize>(slot, 0);
      __free(ptr);
      ptr = 0;
    }
    if (!ptr) {
      // Never grow memory to obtain a batch. Under pressure, an individual
      // allocation can still fit where the larger reservation would fail.
      ptr = trySmallBatch((mixed ? 8192 : span * 128) - runtime.BLOCK_OVERHEAD);
      if (!ptr) return __alloc(size);
    }
    const block = changetype<runtime.BLOCK>(ptr - runtime.BLOCK_OVERHEAD);
    const info = block.mmInfo;
    const remaining = (info & ~3) - payload;
    if (remaining >= 16) {
      const spare = ptr + payload;
      // Both pieces stay allocator-used. Preserve the native LEFTFREE tag;
      // the preceding assigned piece can have been collected between calls.
      block.mmInfo = payload | (info & 2);
      changetype<runtime.BLOCK>(spare).mmInfo =
        remaining - runtime.BLOCK_OVERHEAD;
      // Distinguish the raw tail from a managed object in native heap walks.
      store<u64>(spare + runtime.BLOCK_OVERHEAD, 0);
      store<usize>(slot, spare + runtime.BLOCK_OVERHEAD);
    } else {
      store<usize>(slot, 0);
    }
    return ptr;
  }
  return __alloc(size);
}

// Rebound to a stock TLSF free-list lookup by the transform when available.
// Unsupported runtimes keep the regular per-object allocation fallback.
@inline
function trySmallBatch(_size: usize): usize {
  return 0;
}

/** Return unassigned pieces before the native allocator grows the heap. */
@inline
export function releaseSmallBatches(): bool {
  if (sizeof<usize>() != 4 || isDefined(ASC_RTRACE)) return false;
  let released = false;
  for (let index: usize = 1; index <= 8; index++) {
    const slot = SMALL_BLOCK_HEADS + (index << alignof<usize>());
    const ptr = load<usize>(slot);
    if (ptr) {
      store<usize>(slot, 0);
      __free(ptr);
      released = true;
    }
  }
  return released;
}

/** Physical bytes still reserved in unfinished native small-block batches. */
export function smallBatchReservedBytes(): usize {
  let total: usize = 0;
  for (let index: usize = 1; index <= 8; index++) {
    const ptr = load<usize>(SMALL_BLOCK_HEADS + (index << alignof<usize>()));
    if (ptr)
      total +=
        (load<usize>(ptr - runtime.BLOCK_OVERHEAD) & ~3) +
        runtime.BLOCK_OVERHEAD;
  }
  return total;
}
