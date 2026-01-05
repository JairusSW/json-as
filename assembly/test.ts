import { mask_to_string } from "./util/masks";

function cc(c: u32): void {
  console.log("\n0b:   " + c.toString(2));
  console.log("ctz:      " + ctz(c).toString());
  console.log("ctz >> 3: " + (ctz(c) >> 3).toString());

}

cc(0b1111111100000000)
cc(0b1111111000000000)
cc(0b1111110000000000)
cc(0b1111100000000000)
cc(0b1111000000000000)
cc(0b1110000000000000)
cc(0b1100000000000000)
cc(0b1000000000000000)
console.log("\n\n");
cc(0b0000000011111111)
cc(0b0000000011111110)
cc(0b0000000011111100)
cc(0b0000000011111000)
cc(0b0000000011110000)
cc(0b0000000011100000)
cc(0b0000000011000000)
cc(0b0000000010000000)

console.log(mask_to_string((0xFFFF & ~(0xFF << (1 << 3)))))