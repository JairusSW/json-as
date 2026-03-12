import { JSON } from "../../..";
import { ensureArrayField } from "./shared";


@inline export function deserializeArbitraryArrayField(srcStart: usize, srcEnd: usize, fieldPtr: usize): usize {
  ensureArrayField<JSON.Value[]>(fieldPtr);
  throw new Error("Failed to parse JSON!");
}
