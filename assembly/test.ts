import { JSON } from ".";

const str: JSON.Value[] = [
  JSON.Value.from<string>("foo"),
  JSON.Value.from("bar"),
  JSON.Value.from(1),
  JSON.Value.from(2),
  JSON.Value.from(true),
  JSON.Value.from<JSON.Box<i32> | null>(null)
];

console.log(JSON.stringify(str));
// for (let i = 0; i < str.length; i++) {
  // console.log(str.toString());
// }