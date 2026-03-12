import { JSON } from "../../..";
import { ensureArrayField } from "./shared";


@inline export function deserializeBoxArrayField<T extends JSON.Box<any>[]>(srcStart: usize, srcEnd: usize, fieldPtr: usize): usize {
  ensureArrayField<T>(fieldPtr);
  throw new Error("Failed to parse JSON!");
}
