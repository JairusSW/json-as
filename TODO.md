# TODO

## Existing

- get staticarrays working within classes

## Fast-Path Follow-Ups

- Optimize scan-and-delegate field paths:
  - `JSON.Value` fields (`scanValueEnd(...)` + `JSON.__deserialize<JSON.Value>(...)`)
  - `JSON.Obj` fields (`scanValueEnd(...)` + `JSON.__deserialize<JSON.Obj>(...)`)
  - enum fields (`scanValueEnd(...)` + `JSON.__deserialize<Enum>(...)`)
  - `StaticArray<T>` fields (`deserializeStaticArrayField`: `scanValueEnd(...)` + `deserializeStaticArray(...)`)
  - `Map<K, V>` field values (`deserializeMapField`: `scanValueEnd(...)` per value + `JSON.__deserialize<valueof<T>>(...)`)

## Canada Serialization

- Track Canada benchmark lessons: segment-style serialization, precise `bs` sizing, and delimiting helpers so the pipeline can be reused for other large geo payloads.
- Consider an explicit worker/segment pipeline (serialize each feature independently and concat) before committing a multi-threaded version in production.
- Revisit Dragonbox fast path after `k` ranges shift—always confirm the fast `prettify` early return still applies for new corpora.
