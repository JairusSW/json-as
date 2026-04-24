import { JSON } from "..";
import { expect, fuzz, FuzzSeed } from "as-test";

const ESCAPABLES = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x22, 0x5c];

function makeSafeAscii(seed: FuzzSeed, max: i32 = 128): string {
  return seed.string({
    charset: "ascii",
    min: 0,
    max,
    exclude: ESCAPABLES,
  });
}

fuzz("stringify keeps safe ascii unchanged except for quotes", (value: string): bool => {
  const encoded = JSON.stringify(value);

  expect(encoded.length).toBe(value.length + 2);
  expect(encoded.charCodeAt(0)).toBe(0x22);
  expect(encoded.charCodeAt(encoded.length - 1)).toBe(0x22);
  expect(encoded.slice(1, encoded.length - 1)).toBe(value);

  return !encoded.includes("\\");
}).generate((seed: FuzzSeed, run: (value: string) => bool): void => {
  run(makeSafeAscii(seed));
});
