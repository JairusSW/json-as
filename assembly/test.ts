import { JSON } from "./";


@json
class XidState {
  machineId: Uint8Array; // 3 bytes
  pid: i32;
  counter: i32;
  constructor(machineId: Uint8Array, pid: i32, counter: i32) {
    this.machineId = machineId;
    this.pid = pid;
    this.counter = counter;
  }
}

const rawLen = 12;

let defaultState = new XidState(new Uint8Array(3), 0, 0);


@json
class Xid extends Uint8Array {
  constructor(state: XidState = defaultState) {
    super(rawLen);
    this[4] = state.machineId[0];
    this[5] = state.machineId[1];
    this[6] = state.machineId[2];
    this[7] = state.pid >> 8;
    this[8] = state.pid & 0x00ff;
    state.counter += 1;
    if (state.counter > 0xffffff) {
      state.counter = 0;
    }
    this[9] = state.counter >> 16;
    this[10] = (state.counter >> 8) & 0xff;
    this[11] = state.counter & 0x0000ff;
  }
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

const xid = new Xid();
for (let i = 0; i < rawLen; i++) {
  console.log(JSON.stringify(xid[i]));
}

const hex = new HexBytes(4);
hex[0] = 10;
hex[1] = 20;
hex[2] = 30;
hex[3] = 40;
const encodedHex = JSON.stringify(hex);
const decodedHex = JSON.parse<HexBytes>(encodedHex);

console.log("uint8:   " + JSON.stringify(Uint8Array.wrap(String.UTF8.encode("Hello world"))));
console.log("xid inst:" + (xid instanceof Uint8Array).toString());
console.log("xid:     " + JSON.stringify(xid));
console.log("default: " + JSON.stringify(defaultState));
console.log("hex:     " + encodedHex);
console.log("hex dec: " + JSON.stringify(decodedHex));
