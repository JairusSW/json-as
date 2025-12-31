import { JSON } from "..";
import { describe, expect } from "./lib";

describe("Should serialize strings - Basic", () => {
  expect(JSON.stringify("abcdefg")).toBe('"abcdefg"');
  expect(JSON.stringify('st"ring" w""ith quotes"')).toBe('"st\\"ring\\" w\\"\\"ith quotes\\""');
  expect(JSON.stringify('string "with random spa\nces and \nnewlines\n\n\n')).toBe('"string \\"with random spa\\nces and \\nnewlines\\n\\n\\n"');
  expect(JSON.stringify('string with colon : comma , brace [ ] bracket { } and quote " and other quote \\"')).toBe('"string with colon : comma , brace [ ] bracket { } and quote \\" and other quote \\\\\\""');
  expect(JSON.stringify("\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\u0008\u0009\u000a\u000b\u000c\u000d\u000e\u000f\u000f\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f")).toBe('"\\u0000\\u0001\\u0002\\u0003\\u0004\\u0005\\u0006\\u0007\\b\\t\\n\\u000b\\f\\r\\u000e\\u000f\\u000f\\u0011\\u0012\\u0013\\u0014\\u0015\\u0016\\u0017\\u0018\\u0019\\u001a\\u001b\\u001c\\u001d\\u001e\\u001f"');
  expect(JSON.stringify("abcdYZ12345890sdfw\"vie91kfESDFOK12i9i12dsf./?")).toBe('"abcdYZ12345890sdfw\\"vie91kfESDFOK12i9i12dsf./?"');
});

describe("Should serialize strings - Empty and whitespace", () => {
  expect(JSON.stringify("")).toBe('""');
  expect(JSON.stringify(" ")).toBe('" "');
  expect(JSON.stringify("   ")).toBe('"   "');
  expect(JSON.stringify("\t")).toBe('"\\t"');
  expect(JSON.stringify("\n")).toBe('"\\n"');
  expect(JSON.stringify("\r")).toBe('"\\r"');
  expect(JSON.stringify("\r\n")).toBe('"\\r\\n"');
  expect(JSON.stringify(" \t\n\r ")).toBe('" \\t\\n\\r "');
});

describe("Should serialize strings - Special characters", () => {
  expect(JSON.stringify("\"")).toBe('"\\\""');
  expect(JSON.stringify("\\")).toBe('"\\\\"');
  expect(JSON.stringify("\"\\")).toBe('"\\"\\\\\"');
  expect(JSON.stringify("\\\"")).toBe('"\\\\\\""');
  expect(JSON.stringify("/")).toBe('"/"');
  expect(JSON.stringify("\b")).toBe('"\\b"');
  expect(JSON.stringify("\f")).toBe('"\\f"');
});

describe("Should serialize strings - Control characters", () => {
  expect(JSON.stringify("\u0000")).toBe('"\\u0000"');
  expect(JSON.stringify("\u0001")).toBe('"\\u0001"');
  expect(JSON.stringify("\u001f")).toBe('"\\u001f"');
  expect(JSON.stringify("\u0008")).toBe('"\\b"');
  expect(JSON.stringify("\u0009")).toBe('"\\t"');
  expect(JSON.stringify("\u000a")).toBe('"\\n"');
  expect(JSON.stringify("\u000c")).toBe('"\\f"');
  expect(JSON.stringify("\u000d")).toBe('"\\r"');
});

describe("Should serialize strings - Boundary cases", () => {
  expect(JSON.stringify("\u001f")).toBe('"\\u001f"'); // Last control char
  expect(JSON.stringify(" ")).toBe('" "'); // Space (32) - NOT escaped
  expect(JSON.stringify("!")).toBe('"!"'); // First printable (33)
  expect(JSON.stringify("~")).toBe('"~"'); // Last ASCII (126)
  expect(JSON.stringify("\u007f")).toBe('"\u007f"'); // DEL (127)
});

describe("Should serialize strings - Mixed escapes", () => {
  expect(JSON.stringify("abc\"def\\ghi")).toBe('"abc\\"def\\\\ghi"');
  expect(JSON.stringify("line1\nline2\rline3")).toBe('"line1\\nline2\\rline3"');
  expect(JSON.stringify("\t\t\t")).toBe('"\\t\\t\\t"');
  expect(JSON.stringify("\"\"\"")).toBe('"\\"\\"\\""');
  expect(JSON.stringify("\\\\\\")).toBe('"\\\\\\\\\\\\"');
  expect(JSON.stringify("a\nb\tc\"d\\e")).toBe('"a\\nb\\tc\\"d\\\\e"');
});

describe("Should serialize strings - Unicode", () => {
  expect(JSON.stringify("hello 世界")).toBe('"hello 世界"');
  expect(JSON.stringify("café")).toBe('"café"');
  expect(JSON.stringify("Ḽơᶉëᶆ ȋṕšᶙṁ")).toBe('"Ḽơᶉëᶆ ȋṕšᶙṁ"');
  expect(JSON.stringify("😀🎉😀🎉")).toBe('"😀🎉😀🎉"');
  expect(JSON.stringify("مرحبا")).toBe('"مرحبا"');
  expect(JSON.stringify("Здравствуйте")).toBe('"Здравствуйте"');
});

describe("Should serialize strings - Surrogates", () => {
  // Valid surrogate pairs
  expect(JSON.stringify("\uD83D\uDE00\uD83D\uDE00\uD83D\uDE00")).toBe('"😀😀😀"');
  expect(JSON.stringify("\uD834\uDD1E\uD834\uDD1E\uD834\uDD1E")).toBe('"𝄞𝄞𝄞"');
  
  // Unpaired surrogates
  expect(JSON.stringify("\uD800\uD800\uD800\uD800\uD800")).toBe('"\\ud800\\ud800\\ud800\\ud800\\ud800"'); // unpaired high surrogate
  expect(JSON.stringify("\uDC00\uDC00\uDC00\uDC00\uDC00")).toBe('"\\udc00\\udc00\\udc00\\udc00\\udc00"'); // unpaired low surrogate
  expect(JSON.stringify("\uD800abc\uD800abc\uD800")).toBe('"\\ud800abc\\ud800abc\\ud800"'); // high surrogate followed by normal chars
  expect(JSON.stringify("abc\uDC00abc\uDC00\uDC00")).toBe('"abc\\udc00abc\\udc00\\udc00"'); // normal chars followed by low surrogate
});

describe("Should serialize strings - Long strings", () => {
  const long1 = "a".repeat(1000);
  expect(JSON.stringify(long1)).toBe('"' + long1 + '"');
  
  const long2 = "abc\"def\\ghi".repeat(100);
  const escaped2 = "abc\\\"def\\\\ghi".repeat(100);
  expect(JSON.stringify(long2)).toBe('"' + escaped2 + '"');
  
  const long3 = "hello\nworld\t".repeat(50);
  const escaped3 = "hello\\nworld\\t".repeat(50);
  expect(JSON.stringify(long3)).toBe('"' + escaped3 + '"');
});

describe("Should serialize strings - Edge cases with multiple escapes", () => {
  expect(JSON.stringify("\"\"\"\"\"\"\"\"")).toBe('"\\"\\"\\"\\"\\"\\"\\"\\""');
  expect(JSON.stringify("\\\\\\\\\\\\\\")).toBe('"\\\\\\\\\\\\\\\\\\\\\\\\\\\\"');
  expect(JSON.stringify("\n\n\n\n\n")).toBe('"\\n\\n\\n\\n\\n"');
  expect(JSON.stringify("\t\t\t\t\t")).toBe('"\\t\\t\\t\\t\\t"');
  expect(JSON.stringify("\b\f\n\r\t")).toBe('"\\b\\f\\n\\r\\t"');
});

describe("Should serialize strings - Strings with numbers and symbols", () => {
  expect(JSON.stringify("123456789")).toBe('"123456789"');
  expect(JSON.stringify("!@#$%^&*()")).toBe('"!@#$%^&*()"');
  expect(JSON.stringify("-_=+[{]};:',<.>/?")).toBe('"-_=+[{]};:\',<.>/?"');
  expect(JSON.stringify("test@example.com")).toBe('"test@example.com"');
  expect(JSON.stringify("http://example.com/path?query=value")).toBe('"http://example.com/path?query=value"');
});

describe("Should serialize strings - All control characters", () => {
  for (let i = 0; i < 32; i++) {
    const char = String.fromCharCode(i).repeat(5);
    const result = JSON.stringify(char);
    // Should be escaped in some form
    expect(result.includes("\\")).toBe(true);
  }
});

describe("Should serialize strings - SWAR block boundaries", () => {
  // Test strings that cross 8-byte boundaries
  expect(JSON.stringify("1234567")).toBe('"1234567"'); // 7 chars
  expect(JSON.stringify("12345678")).toBe('"12345678"'); // 8 chars (1 block)
  expect(JSON.stringify("123456789")).toBe('"123456789"'); // 9 chars
  expect(JSON.stringify("1234\"678")).toBe('"1234\\"678"'); // Quote at position 4
  expect(JSON.stringify("1234567\"")).toBe('"1234567\\""'); // Quote at position 7 (boundary)
  expect(JSON.stringify("12345678\"")).toBe('"12345678\\""'); // Quote at position 8 (next block)
});

describe("Should serialize strings - Escapes at various positions", () => {
  expect(JSON.stringify("\"abcdefg")).toBe('"\\"abcdefg"'); // Quote at start
  expect(JSON.stringify("abc\"defg")).toBe('"abc\\"defg"'); // Quote in middle
  expect(JSON.stringify("abcdefg\"")).toBe('"abcdefg\\""'); // Quote at end
  expect(JSON.stringify("\\abcdefg")).toBe('"\\\\abcdefg"'); // Backslash at start
  expect(JSON.stringify("abc\\defg")).toBe('"abc\\\\defg"'); // Backslash in middle
  expect(JSON.stringify("abcdefg\\")).toBe('"abcdefg\\\\"'); // Backslash at end
  expect(JSON.stringify("\nabcdefg")).toBe('"\\nabcdefg"'); // Newline at start
  expect(JSON.stringify("abc\ndefg")).toBe('"abc\\ndefg"'); // Newline in middle
  expect(JSON.stringify("abcdefg\n")).toBe('"abcdefg\\n"'); // Newline at end
});

describe("Should deserialize strings - Basic", () => {
  expect(JSON.parse<string>('"abcdefg"')).toBe("abcdefg");
  expect(JSON.parse<string>('"\\"st\\\\\\"ring\\\\\\" w\\\\\\"\\\\\\"ith quotes\\\\\\"\\""')).toBe('"st\\"ring\\" w\\"\\"ith quotes\\""');
  expect(JSON.parse<string>('"\\"string \\\\\\"with random spa\\\\nces and \\\\nnewlines\\\\n\\\\n\\\\n\\""')).toBe('"string \\"with random spa\\nces and \\nnewlines\\n\\n\\n"');
  expect(JSON.parse<string>('"\\"string with colon : comma , brace [ ] bracket { } and quote \\\\\\" and other quote \\\\\\\\\\"\\""')).toBe('"string with colon : comma , brace [ ] bracket { } and quote \\" and other quote \\\\""');
  expect(JSON.parse<string>('"\\u0000\\u0001\\u0002\\u0003\\u0004\\u0005\\u0006\\u0007\\b\\t\\n\\u000b\\f\\r\\u000e\\u000f\\u000f\\u0011\\u0012\\u0013\\u0014\\u0015\\u0016\\u0017\\u0018\\u0019\\u001a\\u001b\\u001c\\u001d\\u001e\\u001f"')).toBe("\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\u0008\u0009\u000a\u000b\u000c\u000d\u000e\u000f\u000f\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f");
  expect(JSON.parse<string>('"abcdYZ12345890sdfw\\"vie91kfESDFOK12i9i12dsf./?"')).toBe("abcdYZ12345890sdfw\"vie91kfESDFOK12i9i12dsf./?");
});

describe("Should deserialize strings - Empty and whitespace", () => {
  expect(JSON.parse<string>('""')).toBe("");
  expect(JSON.parse<string>('" "')).toBe(" ");
  expect(JSON.parse<string>('"   "')).toBe("   ");
  expect(JSON.parse<string>('"\\t"')).toBe("\t");
  expect(JSON.parse<string>('"\\n"')).toBe("\n");
  expect(JSON.parse<string>('"\\r"')).toBe("\r");
  expect(JSON.parse<string>('"\\r\\n"')).toBe("\r\n");
});

// describe("Should deserialize strings - Special characters", () => {
//   expect(JSON.parse<string>('"\\"')).toBe('"');
//   expect(JSON.parse<string>('"\\\\"')).toBe("\\");
//   expect(JSON.parse<string>('"\\"\\\\"')).toBe('"\\');
//   expect(JSON.parse<string>('"\\\\\\"')).toBe('\\"');
//   expect(JSON.parse<string>('"\\/"')).toBe("/");
//   expect(JSON.parse<string>('"\\b"')).toBe("\b");
//   expect(JSON.parse<string>('"\\f"')).toBe("\f");
//   expect(JSON.parse<string>('"\\n"')).toBe("\n");
//   expect(JSON.parse<string>('"\\r"')).toBe("\r");
//   expect(JSON.parse<string>('"\\t"')).toBe("\t");
// });

// describe("Should deserialize strings - Unicode escapes", () => {
//   expect(JSON.parse<string>('"\\u0000"')).toBe("\u0000");
//   expect(JSON.parse<string>('"\\u0001"')).toBe("\u0001");
//   expect(JSON.parse<string>('"\\u001f"')).toBe("\u001f");
//   expect(JSON.parse<string>('"\\u0041"')).toBe("A");
//   expect(JSON.parse<string>('"\\u0061"')).toBe("a");
//   expect(JSON.parse<string>('"\\u00e9"')).toBe("é");
//   expect(JSON.parse<string>('"\\u4e2d\\u6587"')).toBe("中文");
// });

// describe("Should deserialize strings - Mixed escapes", () => {
//   expect(JSON.parse<string>('"abc\\"def"')).toBe('abc"def');
//   expect(JSON.parse<string>('"line1\\nline2"')).toBe("line1\nline2");
//   expect(JSON.parse<string>('"tab\\there"')).toBe("tab\there");
//   expect(JSON.parse<string>('"back\\\\slash"')).toBe("back\\slash");
//   expect(JSON.parse<string>('"\\"\\\\\\/\\b\\f\\n\\r\\t"')).toBe('"\\/\b\f\n\r\t');
// });

// describe("Should deserialize strings - Unicode characters (non-escaped)", () => {
//   expect(JSON.parse<string>('"café"')).toBe("café");
//   expect(JSON.parse<string>('"hello 世界"')).toBe("hello 世界");
//   expect(JSON.parse<string>('"Здравствуйте"')).toBe("Здравствуйте");
//   expect(JSON.parse<string>('"مرحبا"')).toBe("مرحبا");
// });

// // Surrogate tests commented out - deserialization doesn't handle surrogates yet
// // describe("Should deserialize strings - Surrogates", () => {
// //   expect(JSON.parse<string>('"\\ud83d\\ude00"')).toBe("\uD83D\uDE00"); // 😀
// //   expect(JSON.parse<string>('"\\ud834\\udd1e"')).toBe("\uD834\uDD1E"); // Musical symbol
// //   expect(JSON.parse<string>('"\\ud800"')).toBe("\uD800"); // Unpaired high
// //   expect(JSON.parse<string>('"\\udc00"')).toBe("\uDC00"); // Unpaired low
// // });

// describe("Should deserialize strings - Long strings", () => {
//   const long1 = '"' + "a".repeat(1000) + '"';
//   expect(JSON.parse<string>(long1)).toBe("a".repeat(1000));
  
//   const long2 = '"' + "abc\\ndef".repeat(100) + '"';
//   expect(JSON.parse<string>(long2)).toBe("abc\ndef".repeat(100));
// });

// describe("Should deserialize strings - Roundtrip", () => {
//   const test_strings = [
//     "",
//     "hello",
//     "hello world",
//     'quotes "inside" string',
//     "backslash \\ character",
//     "newline\ncharacter",
//     "tab\tcharacter",
//     "all together: \"\\\n\t",
//     "control chars: \u0000\u0001\u001f",
//     "unicode: café 世界",
//     "long string: " + "x".repeat(500)
//   ];
  
//   for (let i = 0; i < test_strings.length; i++) {
//     const original = test_strings[i];
//     const serialized = JSON.stringify(original);
//     const deserialized = JSON.parse<string>(serialized);
//     expect(deserialized).toBe(original);
//   }
// });