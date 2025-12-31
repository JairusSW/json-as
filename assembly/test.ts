import { bs } from "../lib/as-bs";
import { describe, expect, it } from "./__tests__/lib";
import { serializeString_SIMD } from "./serialize/simd/string";
import { serializeString } from "./serialize/simple/string";
import { serializeString_SWAR } from "./serialize/swar/string";
function runBoth(input: string): void {
  serializeString(input);
  const naive = bs.out<string>();
  serializeString_SIMD(input);
  const simd = bs.out<string>();

  expect(simd).toBe(naive);
}

// describe("serializeString_SIMD (ASCII)", () => {
//   it("plain ascii", () => {
//     runBoth("hello world");
//   });

//   it("quotes", () => {
//     runBoth(`"quoted"`);
//   });

//   it("backslashes", () => {
//     runBoth("a\\b\\c");
//   });

//   it("control characters", () => {
//     runBoth("line\nbreak\ttab\rreturn");
//   });

//   it("mixed escapes", () => {
//     runBoth(`"\n\t\\\""`); 
//   });

//   it("long string", () => {
//     runBoth("a".repeat(256));
//   });

//   it("edge-aligned escape", () => {
//     runBoth("1234567\"");
//   });

//   it("multiple escapes in one block", () => {
//     runBoth("\"\n\\\t\"");
//   });

//   it("no escapes across many blocks", () => {
//     runBoth("abcdefghijklmnopqrstuvwxyz0123456789".repeat(10));
//   });
//   it("empty string", () => {
//     runBoth('string with colon : comma , brace [ ] bracket { } and quote " and other quote \\"');
//   })
// });

describe("Should serialize strings - Unicode", () => {
  console.log("--SWAR--")
  serializeString_SWAR("hello 世界")
  expect(bs.out<string>()).toBe('"hello 世界"');
  console.log("--SIMD--")
  serializeString_SIMD("hello 世界")
  expect(bs.out<string>()).toBe('"hello 世界"');
});
