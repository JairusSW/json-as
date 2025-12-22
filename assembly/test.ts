import { bs } from "../lib/as-bs";
import { serializeString_SIMD } from "./serialize/simd/string";
import { serializeString_SWAR } from "./serialize/swar/string";

serializeString_SWAR("a\0b\"\nd");
serializeString_SIMD("a\0b\"\nd");
console.log(bs.out<string>());