export type NativeDate = Date;
export function makeNative(): NativeDate {
  return new Date(0);
}
