import { JSON } from "../../..";
import { ensureArrayField } from "./shared";


@inline export function deserializeRawArrayField(srcStart: usize, srcEnd: usize, fieldPtr: usize): usize {
  ensureArrayField<JSON.Raw[]>(fieldPtr);
  throw new Error("Failed to parse JSON!");
}
