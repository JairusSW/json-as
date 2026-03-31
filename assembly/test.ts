import { JSON } from ".";


@json
class Example {
  name!: string;

  // @omitnull()
  optionalField!: string | null;
}

const obj1 = new Example();
obj1.name = "Jairus";
obj1.optionalField = null;

console.log(JSON.stringify(obj1)); // { "name": "Jairus" }

const obj2 = new Example();
obj2.name = "Jairus";
obj2.optionalField = "not null!";

console.log(JSON.stringify(obj2)); // { "name": "Jairus" }
