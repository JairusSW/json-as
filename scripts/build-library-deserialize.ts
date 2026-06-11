import { buildMultilibChart } from "./lib/multilib-chart";

// Multi-library DESERIALIZE throughput on the ~1 KiB multilib payload:
// json-as struct/JSON.Obj (NAIVE/SWAR/SIMD) + assemblyscript-json (wasm) vs
// native JSON + fast-json-parse (JS), each in its own fresh V8.
buildMultilibChart("deserialize", "./build/charts/library-deserialize.png");
