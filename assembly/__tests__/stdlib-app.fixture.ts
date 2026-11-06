import { JSON } from "..";
import { OrdinarySession } from "./stdlib-app/session";
import { SecuritySession } from "./stdlib-app/security";
import { MemorySession } from "./stdlib-app/memory";
import { UtilitySession } from "./stdlib-app/util/session";

function check<T>(): void {
  const value = JSON.parse<T>('{"id":7}');
  if (JSON.stringify<T>(value) != '{"id":7}') throw new Error("application model skipped");
}
export function verify(): i32 {
  check<OrdinarySession>();
  check<SecuritySession>();
  check<MemorySession>();
  check<UtilitySession>();
  return 1;
}
