import { JSON } from "..";
import { describe, expect } from "as-test";

class PlainInts extends Array<i32> {
  constructor() {
    super();
  }
}
class PlainMap extends Map<string, i32> {
  constructor() {
    super();
  }
}
class PlainSet extends Set<string> {
  constructor() {
    super();
  }
}
class PlainBytes extends Uint8Array {
  constructor(length: i32 = 0) {
    super(length);
  }
}
class PlainFloats extends Float64Array {
  constructor(length: i32 = 0) {
    super(length);
  }
}


@json
class GeneratedBytes extends Uint8Array {
  constructor(length: i32 = 0) {
    super(length);
  }
}


@json
class GeneratedBytesEnvelope {
  value: GeneratedBytes = new GeneratedBytes(0);
}

function makePlainInts(): PlainInts {
  const out = new PlainInts();
  out.push(1);
  out.push(2);
  out.push(3);
  return out;
}

function makePlainMap(): PlainMap {
  const out = new PlainMap();
  out.set("a", 1);
  out.set("b", 2);
  return out;
}

function makePlainSet(): PlainSet {
  const out = new PlainSet();
  out.add("x");
  out.add("y");
  return out;
}

function makePlainBytes(): PlainBytes {
  const out = new PlainBytes(4);
  out[0] = 10;
  out[1] = 20;
  out[2] = 30;
  out[3] = 40;
  return out;
}

function makeHexBytes(): HexBytes {
  const out = new HexBytes(4);
  out[0] = 10;
  out[1] = 20;
  out[2] = 30;
  out[3] = 40;
  return out;
}

function makePlainFloats(): PlainFloats {
  const out = new PlainFloats(3);
  out[0] = -1.5;
  out[1] = 0.125;
  out[2] = 3.14159;
  return out;
}

function hexDigit(value: u8): string {
  return String.fromCharCode(value < 10 ? 48 + value : 87 + value);
}

function parseHexNibble(code: u16): u8 {
  if (code >= 48 && code <= 57) return <u8>(code - 48);
  if (code >= 97 && code <= 102) return <u8>(code - 87);
  return <u8>(code - 55);
}


@json
class HexBytes extends Uint8Array {
  constructor(length: i32 = 0) {
    super(length);
  }


  @serializer("string")
  serializer(self: HexBytes): string {
    let out = "";
    for (let i = 0; i < self.length; i++) {
      const value = unchecked(self[i]);
      out += hexDigit(value >> 4);
      out += hexDigit(value & 0x0f);
    }
    return JSON.stringify(out);
  }


  @deserializer("string")
  deserializer(data: string): HexBytes {
    const raw = JSON.parse<string>(data);
    const out = new HexBytes(raw.length >> 1);
    for (let i = 0, j = 0; i < raw.length; i += 2, j++) {
      const hi = parseHexNibble(<u16>raw.charCodeAt(i));
      const lo = parseHexNibble(<u16>raw.charCodeAt(i + 1));
      unchecked((out[j] = <u8>((hi << 4) | lo)));
    }
    return out;
  }
}


@json
class CSVArray extends Array<i32> {
  constructor() {
    super();
  }


  @serializer("string")
  serializer(self: CSVArray): string {
    return JSON.stringify(JSON.stringify<Array<i32>>(self));
  }


  @deserializer("string")
  deserializer(data: string): CSVArray {
    const raw = JSON.parse<string>(data);
    const out = new CSVArray();
    if (!raw.length) return out;
    const parsed = JSON.parse<i32[]>(raw);
    for (let i = 0; i < parsed.length; i++) out.push(parsed[i]);
    return out;
  }
}


@json
class TaggedMap extends Map<string, i32> {
  constructor() {
    super();
  }


  @serializer("string")
  serializer(self: TaggedMap): string {
    return JSON.stringify(JSON.stringify<Map<string, i32>>(self));
  }


  @deserializer("string")
  deserializer(data: string): TaggedMap {
    const raw = JSON.parse<string>(data);
    const out = new TaggedMap();
    if (!raw.length) return out;
    const parsed = JSON.parse<Map<string, i32>>(raw);
    if (parsed.has("x")) out.set("x", parsed.get("x"));
    if (parsed.has("y")) out.set("y", parsed.get("y"));
    return out;
  }
}


@json
class TaggedSet extends Set<string> {
  constructor() {
    super();
  }


  @serializer("string")
  serializer(self: TaggedSet): string {
    return JSON.stringify(JSON.stringify<Set<string>>(self));
  }


  @deserializer("string")
  deserializer(data: string): TaggedSet {
    const raw = JSON.parse<string>(data);
    const out = new TaggedSet();
    if (!raw.length) return out;
    const parsed = JSON.parse<Set<string>>(raw);
    if (parsed.has("left")) out.add("left");
    if (parsed.has("right")) out.add("right");
    return out;
  }
}

describe("Should keep built-in behavior for plain Array subclasses", () => {
  const value = makePlainInts();
  expect(JSON.stringify(value)).toBe("[1,2,3]");
});

describe("Should keep built-in behavior for plain Map subclasses", () => {
  const value = makePlainMap();
  expect(JSON.stringify(value)).toBe('{"a":1,"b":2}');
});

describe("Should keep built-in behavior for plain Set subclasses", () => {
  const value = makePlainSet();
  expect(JSON.stringify(value)).toBe('["x","y"]');
});

describe("Should keep built-in behavior for plain Uint8Array subclasses", () => {
  const value = makePlainBytes();
  expect(JSON.stringify(value)).toBe("[10,20,30,40]");
});

describe("Should keep built-in behavior for plain Float64Array subclasses", () => {
  const value = makePlainFloats();
  expect(JSON.stringify(value)).toBe("[-1.5,0.125,3.14159]");
});

describe("Should treat @json typed-array subclasses as generated classes with inherited stdlib fields", () => {
  const value = new GeneratedBytes(4);
  value[0] = 10;
  value[1] = 20;
  value[2] = 30;
  value[3] = 40;

  const encoded = JSON.stringify(value);
  expect(encoded.includes('"buffer":[10,20,30,40]')).toBe(true);
  expect(encoded.includes('"byteLength":4')).toBe(true);
  expect(encoded.includes('"dataStart":')).toBe(true);

  const envelope = new GeneratedBytesEnvelope();
  envelope.value = value;
  const envelopeEncoded = JSON.stringify(envelope);
  expect(envelopeEncoded.includes('"value":')).toBe(true);
  expect(envelopeEncoded.includes('"buffer":[10,20,30,40]')).toBe(true);
});

describe("Should allow Uint8Array subclasses to override serialization", () => {
  const value = makeHexBytes();
  const encoded = JSON.stringify(value);
  expect(encoded).toBe('"0a141e28"');
  const parsed = JSON.parse<HexBytes>(encoded);
  expect(parsed.length.toString()).toBe("4");
  expect(parsed[0].toString()).toBe("10");
  expect(parsed[3].toString()).toBe("40");
  expect(JSON.stringify(parsed)).toBe(encoded);
});

describe("Should allow Array subclasses to override serialization", () => {
  const value = new CSVArray();
  value.push(4);
  value.push(5);
  value.push(6);
  const encoded = JSON.stringify(value);
  expect(encoded).toBe('"[4,5,6]"');
  const parsed = JSON.parse<CSVArray>(encoded);
  expect((parsed instanceof CSVArray).toString()).toBe("true");
  expect(parsed.length.toString()).toBe("3");
  expect(parsed[1].toString()).toBe("5");
  expect(JSON.stringify(parsed)).toBe(encoded);
});

describe("Should allow Map subclasses to override serialization", () => {
  const value = new TaggedMap();
  value.set("x", 7);
  value.set("y", 9);
  const encoded = JSON.stringify(value);
  expect(encoded).toBe('"{\\"x\\":7,\\"y\\":9}"');
  const parsed = JSON.parse<TaggedMap>(encoded);
  expect((parsed instanceof TaggedMap).toString()).toBe("true");
  expect(parsed.get("x").toString()).toBe("7");
  expect(parsed.get("y").toString()).toBe("9");
  expect(JSON.stringify(parsed)).toBe(encoded);
});

describe("Should allow Set subclasses to override serialization", () => {
  const value = new TaggedSet();
  value.add("left");
  value.add("right");
  const encoded = JSON.stringify(value);
  expect(encoded).toBe('"[\\"left\\",\\"right\\"]"');
  const parsed = JSON.parse<TaggedSet>(encoded);
  expect((parsed instanceof TaggedSet).toString()).toBe("true");
  expect(parsed.has("left").toString()).toBe("true");
  expect(parsed.has("right").toString()).toBe("true");
  expect(JSON.stringify(parsed)).toBe(encoded);
});
