import { bytes } from "./bytes";
export function concat(left: string, right: string): string {
  const leftSize: usize = bytes(left);
  const rightSize: usize = bytes(right);
  const jointSize: usize = leftSize + rightSize;
  const jointPtr = __renew(changetype<usize>(left), jointSize);
  memory.copy(changetype<usize>(left) + leftSize, changetype<usize>(right), rightSize);
  return changetype<string>(jointPtr);
}
