import { bs } from "../../../lib/as-bs";
import { ensureItoaPairs, itoaFast } from "../../util/itoa-fast";


@inline
export function serializeIntegerUnsafe<T extends number>(data: T): void {
  ensureItoaPairs();
  const charsWritten = itoaFast<T>(bs.offset, data);
  bs.offset += (<usize>charsWritten) << 1;
}

// @ts-ignore: inline
@inline export function serializeInteger<T extends number>(data: T): void {
  ensureItoaPairs();
  bs.ensureSize(sizeof<T>() << 3);
  const charsWritten = itoaFast<T>(bs.offset, data);
  bs.growSize((<u32>charsWritten) << 1);
  bs.offset += (<usize>charsWritten) << 1;
}
