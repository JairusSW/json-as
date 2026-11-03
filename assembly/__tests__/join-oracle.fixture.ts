import { JSON } from "..";
export function allocInput(bytes: i32): usize {
  return __new(bytes, idof<string>());
}
export function run(source: string, separator: string, eager: bool): string {
  const value = JSON.parse<JSON.Arr>(source);
  if (eager) for (let i = 0; i < value.length; i++) value.at(i);
  // Minimal GC scans pinned/global roots rather than managed stack locals.
  __pin(changetype<usize>(value));
  __collect();
  const result = value.join(separator);
  __unpin(changetype<usize>(value));
  return result;
}
