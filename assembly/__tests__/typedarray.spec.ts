import { JSON } from "..";
import { describe, expect } from "as-test";

function makeInt8Array(): Int8Array {
  const out = new Int8Array(3);
  out[0] = -1;
  out[1] = 0;
  out[2] = 127;
  return out;
}

function makeUint8Array(): Uint8Array {
  const out = new Uint8Array(4);
  out[0] = 0;
  out[1] = 1;
  out[2] = 2;
  out[3] = 255;
  return out;
}

function makeUint8ClampedArray(): Uint8ClampedArray {
  const out = new Uint8ClampedArray(3);
  out[0] = 0;
  out[1] = 128;
  out[2] = 255;
  return out;
}

function makeInt16Array(): Int16Array {
  const out = new Int16Array(3);
  out[0] = -32768;
  out[1] = 0;
  out[2] = 32767;
  return out;
}

function makeUint16Array(): Uint16Array {
  const out = new Uint16Array(3);
  out[0] = 0;
  out[1] = 42;
  out[2] = 65535;
  return out;
}

function makeInt32Array(): Int32Array {
  const out = new Int32Array(3);
  out[0] = -2147483648;
  out[1] = 0;
  out[2] = 2147483647;
  return out;
}

function makeUint32Array(): Uint32Array {
  const out = new Uint32Array(3);
  out[0] = 0;
  out[1] = 42;
  out[2] = 4294967295;
  return out;
}

function makeInt64Array(): Int64Array {
  const out = new Int64Array(3);
  out[0] = -9007199254740991;
  out[1] = 0;
  out[2] = 9007199254740991;
  return out;
}

function makeUint64Array(): Uint64Array {
  const out = new Uint64Array(3);
  out[0] = 0;
  out[1] = 42;
  out[2] = 9007199254740991;
  return out;
}

function makeFloat32Array(): Float32Array {
  const out = new Float32Array(3);
  out[0] = -1.5;
  out[1] = 0.25;
  out[2] = 3.75;
  return out;
}

function makeFloat64Array(): Float64Array {
  const out = new Float64Array(3);
  out[0] = -1.5;
  out[1] = 0.125;
  out[2] = 3.14159;
  return out;
}

function makeArrayBuffer(): ArrayBuffer {
  const out = new ArrayBuffer(4);
  const view = Uint8Array.wrap(out);
  view[0] = 10;
  view[1] = 20;
  view[2] = 30;
  view[3] = 40;
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

function makeHexBytes(): HexBytes {
  const out = new HexBytes(4);
  out[0] = 10;
  out[1] = 20;
  out[2] = 30;
  out[3] = 40;
  return out;
}


@json
class HexBytes extends Uint8Array {
  constructor(length: i32 = 0) {
    super(length);
  }

  toHex(): string {
    let out = "";
    for (let i = 0; i < this.length; i++) {
      const value = unchecked(this[i]);
      out += hexDigit(value >> 4);
      out += hexDigit(value & 0x0f);
    }
    return out;
  }


  @inline __SERIALIZE_CUSTOM(): void {
    JSON.__serialize(this.toHex());
  }


  @inline __DESERIALIZE_CUSTOM(data: string): HexBytes {
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
class HexEnvelope {
  payload: HexBytes = makeHexBytes();
}


@json
class BinaryEnvelope {
  bytes: Uint8Array = makeUint8Array();
  ints: Int16Array = makeInt16Array();
  floats: Float32Array = makeFloat32Array();
  raw: ArrayBuffer = makeArrayBuffer();
}


@json
class BinaryEnvelopeCtor {
  bytes: Uint8Array;
  ints: Int16Array;
  floats: Float32Array;

  constructor() {
    this.bytes = makeUint8Array();
    this.ints = makeInt16Array();
    this.floats = makeFloat32Array();
  }
}


@json
class BinaryContainer {
  left: BinaryEnvelopeCtor = new BinaryEnvelopeCtor();
  right: BinaryEnvelope = new BinaryEnvelope();
}

describe("Should serialize and deserialize typed arrays by default", () => {
  const int8 = makeInt8Array();
  expect(JSON.stringify(int8)).toBe("[-1,0,127]");
  expect(JSON.stringify(JSON.parse<Int8Array>("[-1,0,127]"))).toBe(JSON.stringify(int8));

  const uint8 = makeUint8Array();
  expect(JSON.stringify(uint8)).toBe("[0,1,2,255]");
  expect(JSON.stringify(JSON.parse<Uint8Array>("[0,1,2,255]"))).toBe(JSON.stringify(uint8));

  const uint8Clamped = makeUint8ClampedArray();
  expect(JSON.stringify(uint8Clamped)).toBe("[0,128,255]");
  expect(JSON.stringify(JSON.parse<Uint8ClampedArray>("[0,128,255]"))).toBe(JSON.stringify(uint8Clamped));

  const int16 = makeInt16Array();
  expect(JSON.stringify(int16)).toBe("[-32768,0,32767]");
  expect(JSON.stringify(JSON.parse<Int16Array>("[-32768,0,32767]"))).toBe(JSON.stringify(int16));

  const uint16 = makeUint16Array();
  expect(JSON.stringify(uint16)).toBe("[0,42,65535]");
  expect(JSON.stringify(JSON.parse<Uint16Array>("[0,42,65535]"))).toBe(JSON.stringify(uint16));

  const int32 = makeInt32Array();
  expect(JSON.stringify(int32)).toBe("[-2147483648,0,2147483647]");
  expect(JSON.stringify(JSON.parse<Int32Array>("[-2147483648,0,2147483647]"))).toBe(JSON.stringify(int32));

  const uint32 = makeUint32Array();
  expect(JSON.stringify(uint32)).toBe("[0,42,4294967295]");
  expect(JSON.stringify(JSON.parse<Uint32Array>("[0,42,4294967295]"))).toBe(JSON.stringify(uint32));

  const int64 = makeInt64Array();
  expect(JSON.stringify(int64)).toBe("[-9007199254740991,0,9007199254740991]");
  expect(JSON.stringify(JSON.parse<Int64Array>("[-9007199254740991,0,9007199254740991]"))).toBe(JSON.stringify(int64));

  const uint64 = makeUint64Array();
  expect(JSON.stringify(uint64)).toBe("[0,42,9007199254740991]");
  expect(JSON.stringify(JSON.parse<Uint64Array>("[0,42,9007199254740991]"))).toBe(JSON.stringify(uint64));

  const float32 = makeFloat32Array();
  expect(JSON.stringify(float32)).toBe("[-1.5,0.25,3.75]");
  expect(JSON.stringify(JSON.parse<Float32Array>("[-1.5,0.25,3.75]"))).toBe(JSON.stringify(float32));

  const float64 = makeFloat64Array();
  expect(JSON.stringify(float64)).toBe("[-1.5,0.125,3.14159]");
  expect(JSON.stringify(JSON.parse<Float64Array>("[-1.5,0.125,3.14159]"))).toBe(JSON.stringify(float64));
});

describe("Should serialize and deserialize ArrayBuffer by default", () => {
  const buffer = makeArrayBuffer();
  expect(JSON.stringify(buffer)).toBe("[10,20,30,40]");

  const parsed = JSON.parse<ArrayBuffer>("[10,20,30,40]");
  expect(JSON.stringify(parsed)).toBe(JSON.stringify(buffer));
});

describe("Should support typed arrays and ArrayBuffer inside @json classes", () => {
  const input = new BinaryEnvelope();
  const serialized = JSON.stringify(input);
  expect(serialized).toBe('{"bytes":[0,1,2,255],"ints":[-32768,0,32767],"floats":[-1.5,0.25,3.75],"raw":[10,20,30,40]}');

  const parsed = JSON.parse<BinaryEnvelope>(serialized);
  expect(JSON.stringify(parsed)).toBe(serialized);
  expect(JSON.stringify(parsed.bytes)).toBe(JSON.stringify(input.bytes));
  expect(JSON.stringify(parsed.ints)).toBe(JSON.stringify(input.ints));
  expect(JSON.stringify(parsed.floats)).toBe(JSON.stringify(input.floats));
  expect(JSON.stringify(parsed.raw)).toBe(JSON.stringify(input.raw));
});

describe("Should serialize constructor-assigned typed arrays inside @json classes", () => {
  const input = new BinaryEnvelopeCtor();
  const serialized = JSON.stringify(input);
  expect(serialized).toBe('{"bytes":[0,1,2,255],"ints":[-32768,0,32767],"floats":[-1.5,0.25,3.75]}');
});

describe("Should serialize nested classes with mixed typed-array field initialization styles", () => {
  const input = new BinaryContainer();
  const serialized = JSON.stringify(input);
  expect(serialized).toBe('{"left":{"bytes":[0,1,2,255],"ints":[-32768,0,32767],"floats":[-1.5,0.25,3.75]},"right":{"bytes":[0,1,2,255],"ints":[-32768,0,32767],"floats":[-1.5,0.25,3.75],"raw":[10,20,30,40]}}');
});
