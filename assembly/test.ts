import { JSON } from ".";


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

const rawLen = 12;

let defaultState = new XidState(new Uint8Array(3), 0, 0);


@json
export class Xid extends Uint8Array {
  constructor(state: XidState = defaultState) {
    super(rawLen);
    this[4] = state.machineId[0];
    this[5] = state.machineId[1];
    this[6] = state.machineId[2];
    this[7] = state.pid >> 8;
    this[8] = state.pid & 0x00ff;
    state.counter += 1;
    if (state.counter > 0xffffff) {
      state.counter = 0;
    }
    this[9] = state.counter >> 16;
    this[10] = (state.counter >> 8) & 0xff;
    this[11] = state.counter & 0x0000ff;
  }
}

const xid = new Xid();
for (let i = 0; i < rawLen; i++) {
  console.log(JSON.stringify(xid[i]));
}

console.log(JSON.stringify(xid));
console.log(JSON.stringify(defaultState));
