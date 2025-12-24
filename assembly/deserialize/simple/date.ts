import { ptrToStr } from "../../util/ptrToStr";

// @ts-ignore: inline
@inline export function deserializeDate(srcStart: usize, srcEnd: usize): Date {
  // Use AssemblyScript's date parser
  const d = Date.fromString(ptrToStr(srcStart + 2, srcEnd - 2));

  // Return a new object instead of the one that the parser returned.
  // This may seem redundant, but it addresses the issue when Date
  // is globally aliased to wasi_Date (or some other superclass).
  return new Date(d.getTime());
}
