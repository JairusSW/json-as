import { hex4_to_u16_swar } from "./util/swar";

console.log(load<u64>(changetype<usize>("1234")).toString(16));
console.log(hex4_to_u16_swar(load<u64>(changetype<usize>("1234"))).toString(16))
