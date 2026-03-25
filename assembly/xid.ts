
@json
export class XidState {
  machineId: Uint8Array; // 3 bytes
  pid: i32;
  counter: i32;
  constructor(machineId: Uint8Array, pid: i32, counter: i32) {
    this.machineId = machineId;
    this.pid = pid;
    this.counter = counter;
  }
}
