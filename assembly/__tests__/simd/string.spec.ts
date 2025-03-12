// import { describe, expect, run } from "as-test/assembly";
// import { serializeString_SIMD } from "../../serialize/simd/string";
// import { deserializeString_SIMD } from "../../deserialize/simd/string";

// const out = changetype<usize>(new ArrayBuffer(512));

// const serialize_simd = (data: string): string => String.UTF16.decodeUnsafe(out, serializeString_SIMD(data, out));
// const deserialize_simd = (data: string): string => String.UTF16.decodeUnsafe(out, deserializeString_SIMD(data, out));
// describe("Should serialize strings", () => {
//   expect(serialize_simd("abcdefg")).toBe('"abcdefg"');

//   expect(serialize_simd('st"ring" w""ith quotes"')).toBe('"st\\"ring\\" w\\"\\"ith quotes\\""');

//   expect(serialize_simd('string "with random spa\nces and \nnewlines\n\n\n')).toBe('"string \\"with random spa\\nces and \\nnewlines\\n\\n\\n"');

//   expect(serialize_simd('string with colon : comma , brace [ ] bracket { } and quote " and other quote "')).toBe('"string with colon : comma , brace [ ] bracket { } and quote \\" and other quote \\""');

//   expect(serialize_simd("\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\u0008\u0009\u000a\u000b\u000c\u000d\u000e\u000f\u000f\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f")).toBe('"\\u0000\\u0001\\u0002\\u0003\\u0004\\u0005\\u0006\\u0007\\b\\t\\n\\u000b\\f\\r\\u000e\\u000f\\u000f\\u0011\\u0012\\u0013\\u0014\\u0015\\u0016\\u0017\\u0018\\u0019\\u001a\\u001b\\u001c\\u001d\\u001e\\u001f"');
// });

// describe("Should deserialize strings", () => {
//   expect(deserialize_simd('"abcdefg"')).toBe("abcdefg");
//   expect(deserialize_simd('"st\\"ring\\" w\\"\\"ith quotes\\""')).toBe('st"ring" w""ith quotes"');

//   expect(deserialize_simd('"string \\"with random spa\\nces and \\nnewlines\\n\\n\\n"')).toBe('string "with random spa\nces and \nnewlines\n\n\n');

//   expect(deserialize_simd('"string with colon : comma , brace [ ] bracket { } and quote \\" and other quote \\""')).toBe('string with colon : comma , brace [ ] bracket { } and quote " and other quote "');

//   expect(deserialize_simd('"\\u0000\\u0001\\u0002\\u0003\\u0004\\u0005\\u0006\\u0007\\b\\t\\n\\u000b\\f\\r\\u000e\\u000f\\u000f\\u0011\\u0012\\u0013\\u0014\\u0015\\u0016\\u0017\\u0018\\u0019\\u001a\\u001b\\u001c\\u001d\\u001e\\u001f"')).toBe("\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\u0008\u0009\u000a\u000b\u000c\u000d\u000e\u000f\u000f\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f");
// });

// run();
