import { JSON } from ".";


@json
class Owner {
  login: string = "";
  id: i32 = 0;
}


@json
class Repo {
  name: string = "";
  owner!: JSON.Lazy<Owner>; // typed/accessed as Owner, parsed only when read
}

// NOTE: object-literal init (`const r: Repo = { … }`) does NOT work with lazy
// fields — lazy lowers the field to a get/set accessor, and AssemblyScript's
// object-literal class init doesn't support accessors (it fails the same way for
// any hand-written getter/setter). Construct with `new` + assignment (which goes
// through the setter), or just use `JSON.parse`.
const owner = new Owner();
owner.login = "bar";
owner.id = 97;

const repo = new Repo();
repo.name = "foo";
repo.owner = owner; // setter

const serialized = JSON.stringify(repo);
console.log(serialized);

const deserialized = JSON.parse<Repo>(serialized);
console.log("name  = " + deserialized.name);
console.log("login = " + deserialized.owner.login); // owner parsed on first read
console.log("id    = " + deserialized.owner.id.toString());
