import { JSON } from ".";

function hexDigit(value: u8): string {
  return String.fromCharCode(value < 10 ? 48 + value : 87 + value);
}

function parseHexNibble(code: u16): u8 {
  if (code >= 48 && code <= 57) return <u8>(code - 48);
  if (code >= 97 && code <= 102) return <u8>(code - 87);
  return <u8>(code - 55);
}

class PlainBytes extends Uint8Array {
  constructor(length: i32 = 0) {
    super(length);
  }
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


  @serializer("string")
  serializer(self: HexBytes): string {
    return JSON.stringify(self.toHex());
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
class HexEnvelope {
  payload: HexBytes = new HexBytes();
}

const plain = new Uint8Array(4);
plain[0] = 10;
plain[1] = 20;
plain[2] = 30;
plain[3] = 40;

const builtinSubclass = new PlainBytes(4);
builtinSubclass[0] = 10;
builtinSubclass[1] = 20;
builtinSubclass[2] = 30;
builtinSubclass[3] = 40;

const custom = new HexBytes(4);
custom[0] = 10;
custom[1] = 20;
custom[2] = 30;
custom[3] = 40;

const encoded = JSON.stringify(custom);
const direct = JSON.parse<HexBytes>(encoded);
const decoded = JSON.parse<HexEnvelope>(`{"payload":${encoded}}`);

console.log("plain:   " + JSON.stringify(plain));
console.log("subclass:" + JSON.stringify(builtinSubclass));
console.log("custom:  " + encoded);
console.log("direct:  " + JSON.stringify(direct));
console.log("decoded: " + JSON.stringify(decoded));
