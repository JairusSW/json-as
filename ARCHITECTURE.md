# Architecture

This document describes the architecture of json-as, a high-performance JSON serialization library for AssemblyScript.

## Overview

json-as uses a two-tier architecture:

1. **Compile-time Transform**: A TypeScript-based AST transformer that generates optimized serialization/deserialization code
2. **Runtime Library**: AssemblyScript implementations for JSON processing with multiple optimization levels

```
┌─────────────────────────────────────────────────────────────────┐
│                        Compile Time                             │
│   ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│   │ Source Code │ -> │  Transform   │ -> │ Generated Code   │   │
│   │ with @json  │    │ (TypeScript) │    │ __SERIALIZE etc  │   │
│   └─────────────┘    └──────────────┘    └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              V
┌─────────────────────────────────────────────────────────────────┐
│                      Runtime                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    JSON Namespace                        │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │  stringify  │  │    parse    │  │  Dynamic Types  │   │   │
│  │  └──────┬──────┘  └──────┬──────┘  │  Value, Obj,    │   │   │
│  │         │                │         │  Box, Raw       │   │   │
│  │         V                V         └─────────────────┘   │   │
│  │  ┌───────────────────────────────────────────────────┐   │   │
│  │  │               Optimization Modes                  │   │   │
│  │  │         ┌───────┐  ┌────────┐  ┌────────┐         │   │   │
│  │  │         │ NAIVE │  │  SWAR  │  │  SIMD  │         │   │   │
│  │  │         └───────┘  └────────┘  └────────┘         │   │   │
│  │  └───────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              V                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Memory Allocator (bs namespace)             │   │
│  │  - Dynamic buffer management                             │   │
│  │  - EMA-based adaptive sizing                             │   │
│  │  - Optional string caching (sc namespace)                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Transform System

The transform (`transform/src/`) is an AssemblyScript compiler plugin that runs during compilation.

### How It Works

1. **Discovery**: Scans source files for classes decorated with `@json` or `@serializable`
2. **Schema Building**: Creates a schema for each decorated class including:
   - Field names and types
   - Decorator metadata (@alias, @omit, @omitnull, @omitif)
   - Inheritance relationships
   - Type dependencies
3. **Code Generation**: Generates two methods for each class:
   - `__SERIALIZE(ptr: usize): void` - Writes JSON to the buffer
   - `__DESERIALIZE<T>(srcStart, srcEnd, out): T` - Parses JSON into object

### Key Files

- `transform/src/index.ts` - Main transform entry point (JSONTransform class)
- `transform/src/visitor.ts` - AST visitor for traversing source code
- `transform/src/builder.ts` - AST builder for code generation
- `transform/src/types.ts` - Type definitions (Property, Schema, Src)

### Generated Code Example

For this class:
```typescript
@json
class Player {
  name: string = "";
  score: i32 = 0;
}
```

The transform generates:
```typescript
__SERIALIZE(ptr: usize): void {
  store<u16>(bs.offset, 123); // {
  bs.offset += 2;
  // ... "name": serialize string ...
  // ... "score": serialize integer ...
  store<u16>(bs.offset, 125); // }
  bs.offset += 2;
}

__DESERIALIZE<T>(srcStart: usize, srcEnd: usize, out: T): T {
  // Key matching and value parsing logic
  // Uses switch statements on key length for efficiency
}
```

## Optimization Modes

json-as provides three optimization levels, selected via the `JSON_MODE` environment variable:

### NAIVE Mode

The baseline implementation with character-by-character processing.

- **Best for**: Debugging, compatibility testing
- **Performance**: Slowest but most readable
- **String escaping**: Checks each character individually

### SWAR Mode (Default)

Single Instruction, Multiple Data processing at the word level.

- **Best for**: General use, good balance of speed and compatibility
- **Performance**: Processes 4 characters at once
- **String escaping**: Uses bit manipulation to detect escape characters in parallel:
  ```
  // Check if any byte in a 64-bit word needs escaping
  const hasEscape = (word ^ 0x2222...) - 0x0101... & 0x8080...
  ```

### SIMD Mode

Uses WebAssembly SIMD instructions for 128-bit parallel processing.

- **Best for**: Maximum performance when SIMD is available
- **Performance**: Processes 8 characters at once
- **Requirement**: `--enable simd` flag during compilation
- **String escaping**: Uses `v128` operations for parallel character checking

## Buffer System

Located in `lib/as-bs.ts`, the buffer system (`bs` namespace) manages memory for serialization output.

### Key Features

1. **Dynamic Growth**: Buffer grows as needed during serialization
2. **Adaptive Sizing**: Uses exponential moving average (EMA) to track typical output sizes
3. **Automatic Shrinking**: Periodically shrinks if buffer is oversized for typical usage

### Memory Layout

```
┌───────────────────────────────────────────┐
│              ArrayBuffer                  │
│  ┌───────────────────┬─────────────────┐  │
│  │   Written Data    │   Free Space    │  │
│  └───────────────────┴─────────────────┘  │
│  ^ buffer            ^ offset             │
└───────────────────────────────────────────┘
```

### Key Functions

- `proposeSize(size)` - Ensure buffer can hold additional bytes
- `ensureSize(size)` - Grow buffer if necessary
- `out<T>()` - Copy buffer contents to new string, reset for next use
- `resize(size)` - Explicitly resize buffer

### String Caching (`sc` namespace)

Optional feature enabled via `JSON_CACHE=1` for repeated string serialization.

```
┌───────────────────────────────────────────────────────────────┐
│                    Cache Structure                            │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Entry Table (4096 slots)                               │  │
│  │  ┌────────┬────────┬────────┬────────┐                  │  │
│  │  │ Entry 0│ Entry 1│  ...   │Entry N │                  │  │
│  │  │key,ptr,│key,ptr,│        │key,ptr,│                  │  │
│  │  │  len   │  len   │        │  len   │                  │  │
│  │  └────────┴────────┴────────┴────────┘                  │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Arena (1MB circular buffer)                            │  │
│  │  ┌──────────────────────────────────────────────────┐   │  │
│  │  │  Cached serialized string data...                │   │  │
│  │  └──────────────────────────────────────────────────┘   │  │
│  │                                          ^              │  │
│  │                                       arenaPtr          │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

## Type System

### Static Types

Regular AssemblyScript types handled directly:
- Primitives: `i8`, `i16`, `i32`, `i64`, `u8`, `u16`, `u32`, `u64`, `f32`, `f64`, `bool`
- Strings: `string`
- Collections: `Array<T>`, `StaticArray<T>`, `Map<K, V>`
- Classes decorated with `@json`

### Dynamic Types

For runtime type flexibility:

- **`JSON.Value`**: Can hold any JSON type
  ```typescript
  const v = JSON.Value.from<i32>(42);
  v.set<string>("hello");  // Can change type
  ```

- **`JSON.Obj`**: Dynamic object with string keys
  ```typescript
  const obj = new JSON.Obj();
  obj.set("key", 123);
  ```

- **`JSON.Box<T>`**: Nullable wrapper for primitives
  ```typescript
  let maybeInt: JSON.Box<i32> | null = null;
  ```

- **`JSON.Raw`**: Pre-formatted JSON string (no re-serialization)
  ```typescript
  map.set("data", new JSON.Raw('{"already":"json"}'));
  ```

## Serialization Flow

```
JSON.stringify<T>(data)
        │
        V
┌───────────────────┐
│  Type Dispatch    │
│  (compile-time)   │
└─────────┬─────────┘
          │
    ┌─────┴─────┬─────────────┬──────────────┐
    V           V             V              V
┌───────┐  ┌────────┐   ┌──────────┐   ┌──────────┐
│Boolean│  │Integer │   │  String  │   │  Struct  │
│ Float │  │        │   │          │   │ (@json)  │
└───┬───┘  └────┬───┘   └────┬─────┘   └────┬─────┘
    │           │            │              │
    │           │            │              │
    └───────────┴─────┬──────┴──────────────┘
                      V
              ┌───────────────┐
              │ Buffer System │
              └───────┬───────┘
                      V
              ┌───────────────┐
              │     Heap      │
              └───────┬───────┘
                      V
                   String
```

## Deserialization Flow

```
JSON.parse<T>(jsonString)
        │
        V
┌───────────────────┐
│  Type Dispatch    │
│  (compile-time)   │
└─────────┬─────────┘
          │
    ┌─────┴─────┬─────────────┬──────────────┐
    V           V             V              V
┌───────┐  ┌────────┐   ┌──────────┐   ┌──────────┐
│Boolean│  │Integer │   │  String  │   │  Struct  │
└───┬───┘  └────┬───┘   └────┬─────┘   └────┬─────┘
    │           │            │              │
    └───────────┴─────┬──────┴──────────────┘
                      │
                      V
                      T
```

### Struct Deserialization

For `@json` decorated classes, the generated `__DESERIALIZE` method:

1. Scans for opening `{`
2. Iterates through key-value pairs
3. Uses switch on key length for fast dispatch
4. Compares key bytes directly (often as `u32` or `u64` for short keys)
5. Deserializes value to appropriate type
6. Stores in output object at correct offset

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JSON_MODE` | SWAR | Optimization mode: NAIVE, SWAR, SIMD |
| `JSON_DEBUG` | 0 | Debug level 0-3 (prints generated code) |
| `JSON_WRITE` | "" | Comma-separated files to output after transform |
| `JSON_CACHE` | 0 | Enable string caching (set to 1) |
| `JSON_STRICT` | false | Enable strict JSON validation |

## Performance Considerations

### Serialization

- Pre-computes static key bytes at compile time
- Uses direct memory stores for known strings
- SIMD/SWAR for escape character detection
- Optional caching for repeated strings

### Deserialization

- Groups fields by key length for switch optimization
- Uses direct memory loads for key comparison
- Avoids string allocation during key matching
- Tracks depth for nested structures

### Memory

- Single reusable buffer reduces allocations
- EMA-based sizing prevents memory waste
- Circular arena for cache prevents unbounded growth
