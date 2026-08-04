# JSON-AS

JSON-AS maps JSON documents to strongly typed AssemblyScript values, with schema-derived behavior optimized for predictable execution.

## Language

**JSON Struct**:
An AssemblyScript class whose JSON shape is declared with `@json` and can be serialized or deserialized according to that shape.
_Avoid_: JSON model, decorated object

**Generated Codec**:
The schema-derived serialization and deserialization behavior associated with a JSON Struct.
_Avoid_: generated serde, generated parser

**Canonical Input**:
A compact JSON object whose keys appear in the JSON Struct's declared schema order, with no insignificant whitespace.
_Avoid_: happy path, normal JSON

**Lazy Field**:
A JSON Struct field whose value is represented by its source range until first access.
_Avoid_: deferred property, lazy slot

**Fresh Deserialization**:
Deserialization that creates a new JSON Struct.
_Avoid_: allocating parse

**Reuse Deserialization**:
Deserialization that writes into a caller-provided JSON Struct while retaining reusable allocations where possible.
_Avoid_: in-place parse, cached parse
