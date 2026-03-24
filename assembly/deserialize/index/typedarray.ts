import { bytes } from "../../util";
export { deserializeArrayBuffer, deserializeTypedArray } from "../simple/typedarray";
import { deserializeArrayBuffer, deserializeTypedArray } from "../simple/typedarray";


@inline export function parseArrayBuffer(data: string): ArrayBuffer {
  const dataSize = bytes(data);
  const dataPtr = changetype<usize>(data);
  return deserializeArrayBuffer(dataPtr, dataPtr + dataSize, 0);
}


@inline export function __deserializeArrayBuffer(srcStart: usize, srcEnd: usize, dst: usize = 0): ArrayBuffer {
  return deserializeArrayBuffer(srcStart, srcEnd, dst);
}
