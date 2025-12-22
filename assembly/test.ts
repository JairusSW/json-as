import { bs } from "../lib/as-bs";
import { serializeString_SIMD } from "./serialize/simd/string";
import { serializeString_SWAR } from "./serialize/swar/string";

serializeString_SWAR("ab\"d");
// serializeString_SIMD("ab\"defgh");
console.log(bs.out<string>());