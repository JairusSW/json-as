import { JSON } from ".";

const s = new Set<string>();
s.add("Hello");
s.add("World");
s.add("!");

const serialized = JSON.stringify(s);
console.log("Serialized: " + serialized);

const deserialized = JSON.parse<Set<string>>(serialized);
console.log("Deserialized: " + JSON.stringify(deserialized));


@json
class SetClass {
  constructor(public items: Set<string>) {}
}

const setClass = new SetClass(s);
const serializedClass = JSON.stringify(setClass);
console.log("Serialized Class: " + serializedClass);

const deserializedClass = JSON.parse<SetClass>(serializedClass);
console.log("Deserialized Class: " + JSON.stringify(deserializedClass));
