import { JSON } from ".";

@json
class Vec3 {
  x!: f32;
  y!: f32;
  z!: f32;
}

const vec: Vec3 = {
  x: 1.0,
  y: 2.0,
  z: 3.0
}
const str: JSON.Value[] = [
  JSON.Value.from<string>("foo"),
  JSON.Value.from("bar"),
  JSON.Value.from(1),
  JSON.Value.from(2),
  JSON.Value.from(true),
  JSON.Value.from<JSON.Box<i32> | null>(null),
  JSON.Value.from(vec),
  JSON.Value.from<Vec3 | null>(null)
];

const serialized = JSON.stringify(str);
console.log("Serialized: " + serialized);

const deserialized = JSON.parse<JSON.Value[]>(serialized);
console.log("Deserialized: " + JSON.stringify(deserialized).toString());