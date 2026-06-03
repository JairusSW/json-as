import { buildMultilibChart } from "./lib/multilib-chart";

// Multi-library SERIALIZE throughput on the ~1 KiB multilib payload:
// json-as struct/JSON.Obj (NAIVE/SWAR/SIMD) + assemblyscript-json (wasm) vs
// native JSON + fast-json-stringify (JS), each in its own fresh V8.
buildMultilibChart("serialize", "./build/charts/chart13.png");
