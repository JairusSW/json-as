import { Parser } from "assemblyscript/dist/assemblyscript.js";
import { Property, PropertyFlags, Src } from "../types.js";

export function sortMembers(members: Property[]): Property[] {
  return members.sort((a, b) => {
    const aMove =
      a.flags.has(PropertyFlags.OmitIf) || a.flags.has(PropertyFlags.OmitNull);
    const bMove =
      b.flags.has(PropertyFlags.OmitIf) || b.flags.has(PropertyFlags.OmitNull);

    if (aMove && !bMove) {
      return -1;
    } else if (!aMove && bMove) {
      return 1;
    } else {
      return 0;
    }
  });
}

export function toU16(data: string, offset: number = 0): string {
  return data.charCodeAt(offset).toString();
}

export function toU32(data: string, offset: number = 0): string {
  return (
    (data.charCodeAt(offset + 1) << 16) |
    data.charCodeAt(offset)
  ).toString();
}

export function toU48(data: string, offset: number = 0): string {
  return (
    (BigInt(data.charCodeAt(offset + 2)) << 32n) |
    (BigInt(data.charCodeAt(offset + 1)) << 16n) |
    BigInt(data.charCodeAt(offset))
  ).toString();
}

export function toU64(data: string, offset: number = 0): string {
  return (
    (BigInt(data.charCodeAt(offset + 3)) << 48n) |
    (BigInt(data.charCodeAt(offset + 2)) << 32n) |
    (BigInt(data.charCodeAt(offset + 1)) << 16n) |
    BigInt(data.charCodeAt(offset))
  ).toString();
}

export function toMemCDecl(n: number, indent: string): string {
  let out = "";
  let offset = 0;
  let index = 0;
  while (n >= 8) {
    out += `${indent}const codeS${(index += 8)} = load<u64>(keyStart, ${offset});\n`;
    offset += 8;
    n -= 8;
  }

  while (n >= 4) {
    out += `${indent}const codeS${(index += 4)} = load<u32>(keyStart, ${offset});\n`;
    offset += 4;
    n -= 4;
  }

  if (n == 1)
    out += `${indent}const codeS${(index += 1)} = load<u16>(keyStart, ${offset});\n`;

  return out;
}

export function toMemCCheck(data: string): string {
  let n = data.length << 1;
  let out = "";
  let offset = 0;
  let index = 0;
  while (n >= 8) {
    out += ` && codeS${(index += 8)} == ${toU64(data, offset >> 1)}`;
    offset += 8;
    n -= 8;
  }

  while (n >= 4) {
    out += ` && codeS${(index += 4)} == ${toU32(data, offset >> 1)}`;
    offset += 4;
    n -= 4;
  }

  if (n == 1) out += ` && codeS${(index += 1)} == ${toU16(data, offset >> 1)}`;

  return out.slice(4);
}

export function strToNum(
  data: string,
  simd: boolean = false,
  offset: number = 0,
): string[][] {
  const out: string[][] = [];
  let n = data.length;

  while (n >= 8 && simd) {
    out.push([
      "v128",
      "i16x8(" +
        data.charCodeAt(offset) +
        ", " +
        data.charCodeAt(offset + 1) +
        ", " +
        data.charCodeAt(offset + 2) +
        ", " +
        data.charCodeAt(offset + 3) +
        ", " +
        data.charCodeAt(offset + 4) +
        ", " +
        data.charCodeAt(offset + 5) +
        ", " +
        data.charCodeAt(offset + 6) +
        ", " +
        data.charCodeAt(offset + 7) +
        ")",
    ]);
    offset += 8;
    n -= 8;
  }

  while (n >= 4) {
    const value =
      (BigInt(data.charCodeAt(offset + 3)) << 48n) |
      (BigInt(data.charCodeAt(offset + 2)) << 32n) |
      (BigInt(data.charCodeAt(offset + 1)) << 16n) |
      BigInt(data.charCodeAt(offset));
    out.push(["u64", value.toString()]);
    offset += 4;
    n -= 4;
  }

  while (n >= 2) {
    const value =
      (data.charCodeAt(offset + 1) << 16) | data.charCodeAt(offset);
    out.push(["u32", value.toString()]);
    offset += 2;
    n -= 2;
  }

  if (n === 1) {
    const value = data.charCodeAt(offset);
    out.push(["u16", value.toString()]);
  }

  return out;
}

export function sizeof(type: string): number {
  if (type == "u8")
    return 6; // -127
  else if (type == "i8")
    return 8; // 255
  else if (type == "u16")
    return 10; // 65536
  else if (type == "i16")
    return 12; // -32767
  else if (type == "u32")
    return 20; // 4294967295
  else if (type == "i32")
    return 22; // -2147483647
  else if (type == "u64")
    return 40; // 18446744073709551615
  else if (type == "i64")
    return 40; // -9223372036854775807
  else if (type == "bool" || type == "boolean") return 10;
  else return 0;
}

export function isPrimitive(type: string): boolean {
  const primitiveTypes = [
    "u8",
    "u16",
    "u32",
    "u64",
    "i8",
    "i16",
    "i32",
    "i64",
    "f32",
    "f64",
    "bool",
    "boolean",
  ];
  return primitiveTypes.some((v) => type.startsWith(v));
}

export function isBoolean(type: string): boolean {
  return type == "bool" || type == "boolean";
}

export function stripNull(type: string): string {
  if (type.endsWith(" | null")) {
    return type.slice(0, type.length - 7);
  } else if (type.startsWith("null | ")) {
    return type.slice(7);
  }
  return type;
}

export function isString(type: string): boolean {
  const nonNull = stripNull(type);
  return nonNull == "string" || nonNull == "String";
}

export function isArray(type: string): boolean {
  return (
    type.startsWith("Array<") ||
    type.startsWith("Set<") ||
    type.startsWith("StaticArray<")
  );
}

export function isEnum(type: string, source: Src, parser: Parser): boolean {
  return (
    source.getEnum(type) != null || source.getImportedEnum(type, parser) != null
  );
}

export function getComparison(data: string): string {
  switch (data.length << 1) {
    case 2: {
      return "code16 == " + data.charCodeAt(0);
    }
    case 4: {
      return "code32 == " + toU32(data);
    }
    case 6: {
      return "code48 == " + toU48(data);
    }
    case 8: {
      return "code64 == " + toU64(data);
    }
    default: {
      return toMemCCheck(data);
    }
  }
}
