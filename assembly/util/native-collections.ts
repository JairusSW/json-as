// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

// Storage-only views of built-in collections. These add no fields and are never
// constructed. Explicit super calls preserve native JSON semantics even when a
// requested subclass overrides its public mutation or enumeration methods.
export class NativeMap<K, V> extends Map<K, V> {

  @inline nativeSet(key: K, value: V): void {
    super.set(key, value);
  }

  @inline nativeGet(key: K): V {
    return super.get(key);
  }

  @inline nativeHas(key: K): bool {
    return super.has(key);
  }

  @inline nativeDelete(key: K): bool {
    return super.delete(key);
  }

  @inline nativeClear(): void {
    super.clear();
  }

  @inline nativeKeys(): K[] {
    return super.keys();
  }

  @inline nativeValues(): V[] {
    return super.values();
  }

  @inline nativeSize(): i32 {
    return super.size;
  }
}
export class NativeSet<K> extends Set<K> {

  @inline nativeAdd(value: K): void {
    super.add(value);
  }

  @inline nativeHas(value: K): bool {
    return super.has(value);
  }

  @inline nativeDelete(value: K): bool {
    return super.delete(value);
  }

  @inline nativeClear(): void {
    super.clear();
  }

  @inline nativeValues(): K[] {
    return super.values();
  }

  @inline nativeSize(): i32 {
    return super.size;
  }
}
