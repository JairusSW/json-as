import { OBJECT, TOTAL_OVERHEAD } from "rt/common";

export function idofD<T>(value: T): usize {
  return changetype<OBJECT>(changetype<usize>(value) - TOTAL_OVERHEAD).rtId;
}
