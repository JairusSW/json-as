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
