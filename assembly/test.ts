import { bs } from "../lib/as-bs";
import { serializeString } from "./serialize/simple/string";
import { serializeString_SWAR } from "./serialize/swar/string";

function testSerialize(input: string, expected: string, description: string): void {
  serializeString_SWAR(input);
  const output = bs.out<string>();
  if (output !== expected) {
    console.log("Failed: " + description);
    console.log("  Input:    " + (serializeString(input), bs.out<string>()));
    console.log("  Expected (" + expected.length.toString() + "): " + expected);
    console.log("  Got      (" + output.length.toString() + "): " + output);
    process.exit(1);
  }
  console.log("Passed: " + description + "\n")
}

// ------------------------
// 1. Plain ASCII text
// ------------------------
testSerialize("Hello World!", '"Hello World!"', "Plain ASCII text should not escape");

// ------------------------
// 2. Quote and backslash
// ------------------------
testSerialize('He said: "Hello"', '"He said: \\"Hello\\""', 'Quotes should be escaped');
testSerialize("Path\\to\\file", '"Path\\\\to\\\\file"', 'Backslashes should be escaped');

// ------------------------
// 3. Control codes
// ------------------------
testSerialize("\u0000\u0001\u001F\u0000\u0001\u001F", '"\\u0000\\u0001\\u001f\\u0000\\u0001\\u001f"', 'Control codes should be escaped');

// ------------------------
// 4. Surrogate / codepoint check
// ------------------------
testSerialize("\uD83D\uDE00\uD83D\uDE00", '"😀😀"', 'Paired surrogate (😀) should be written as is');
testSerialize("\uD83Dabc", '"\\ud83dabc"', 'Unpaired high surrogate should be escaped');
testSerialize("\uDE00\uDE00\uDE00\uDE00", '"\\ude00\\ude00\\ude00\\ude00"', 'Unpaired low surrogate should be escaped');

// ------------------------
// 5. Mixed ASCII + Unicode
// ------------------------
testSerialize('A\uD83D\uDE00B', '"A😀B"', 'Mixed ASCII + emoji should serialize correctly');

// Paired surrogate
testSerialize("\uD83D\uDE00\uD83D\uDE00\uD83D\uDE00\uD83D\uDE00", '"😀😀😀😀"', "Paired surrogate (😀)");

// Unpaired high surrogate
testSerialize("\uD83D\uD83D\uD83D\uD83D", '"\\ud83d\\ud83d\\ud83d\\ud83d"', "Unpaired high surrogate should be escaped");

// Unpaired low surrogate
testSerialize("\uDE00\uDE00\uDE00\uDE00", '"\\ude00\\ude00\\ude00\\ude00"', "Unpaired low surrogate should be escaped");

// Mixed paired + ASCII
testSerialize("A\uD83D\uDE00B", '"A😀B"', "ASCII + paired surrogate");

// Mixed unpaired + ASCII
testSerialize("A\uD83DB\uDE00C", '"A\\ud83dB\\ude00C"', "ASCII + unpaired surrogates should be escaped");

// BMP non-ASCII
testSerialize("©é漢", '"©é漢"', "BMP non-ASCII characters");

// ASCII only
testSerialize("Hello!", '"Hello!"', "ASCII only");

// ASCII + quote + backslash
testSerialize('He said: "Hi\\"', '"He said: \\"Hi\\\\\\""', "");


console.log("All tests passed!");
