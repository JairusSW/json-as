import { JSON } from "..";
import { describe, expect } from "./lib";

describe("Should serialize strings", () => {
  expect(JSON.stringify("abcdefg")).toBe('"abcdefg"');

  expect(JSON.stringify('st"ring" w""ith quotes"')).toBe('"st\\"ring\\" w\\"\\"ith quotes\\""');

  expect(JSON.stringify('string "with random spa\nces and \nnewlines\n\n\n')).toBe('"string \\"with random spa\\nces and \\nnewlines\\n\\n\\n"');

  expect(JSON.stringify('string with colon : comma , brace [ ] bracket { } and quote " and other quote \\"')).toBe('"string with colon : comma , brace [ ] bracket { } and quote \\" and other quote \\\\\\""');

  expect(JSON.stringify("\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\u0008\u0009\u000a\u000b\u000c\u000d\u000e\u000f\u000f\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f")).toBe('"\\u0000\\u0001\\u0002\\u0003\\u0004\\u0005\\u0006\\u0007\\b\\t\\n\\u000b\\f\\r\\u000e\\u000f\\u000f\\u0011\\u0012\\u0013\\u0014\\u0015\\u0016\\u0017\\u0018\\u0019\\u001a\\u001b\\u001c\\u001d\\u001e\\u001f"');

  expect(JSON.stringify("abcdYZ12345890sdfw\"vie91kfESDFOK12i9i12dsf./?")).toBe('"abcdYZ12345890sdfw\\"vie91kfESDFOK12i9i12dsf./?"');
});

describe("Should deserialize strings", () => {
  expect(JSON.parse<string>('"abcdefg"')).toBe("abcdefg");

  expect(JSON.parse<string>('"\\"st\\\\\\"ring\\\\\\" w\\\\\\"\\\\\\"ith quotes\\\\\\"\\""')).toBe('"st\\"ring\\" w\\"\\"ith quotes\\""');

  expect(JSON.parse<string>('"\\"string \\\\\\"with random spa\\\\nces and \\\\nnewlines\\\\n\\\\n\\\\n\\""')).toBe('"string \\"with random spa\\nces and \\nnewlines\\n\\n\\n"');

  expect(JSON.parse<string>('"\\"string with colon : comma , brace [ ] bracket { } and quote \\\\\\" and other quote \\\\\\\\\\"\\""')).toBe('"string with colon : comma , brace [ ] bracket { } and quote \\" and other quote \\\\""');

  expect(JSON.parse<string>('"\\u0000\\u0001\\u0002\\u0003\\u0004\\u0005\\u0006\\u0007\\b\\t\\n\\u000b\\f\\r\\u000e\\u000f\\u000f\\u0011\\u0012\\u0013\\u0014\\u0015\\u0016\\u0017\\u0018\\u0019\\u001a\\u001b\\u001c\\u001d\\u001e\\u001f"')).toBe("\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\u0008\u0009\u000a\u000b\u000c\u000d\u000e\u000f\u000f\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f");

  expect(JSON.parse<string>('"abcdYZ12345890sdfw\\"vie91kfESDFOK12i9i12dsf./?"')).toBe("abcdYZ12345890sdfw\"vie91kfESDFOK12i9i12dsf./?");
});
