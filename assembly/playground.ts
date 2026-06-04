import { JSON } from ".";

// Scratch pad for exploring json-as. `npm run pg` rebuilds the transform,
// compiles this file (always dumping the transformed source to
// assembly/playground.tmp.ts via JSON_WRITE), and runs it under wasmtime so
// console.log output shows up immediately.

@json
class Owner {
  login: string = "";
  id: i32 = 0;
}


@json({ lazy: "auto" })
class Repo {
  id: i32 = 0; // cheap -> eager
  name: string = ""; // deferred (string)
  owner: Owner = new Owner(); // deferred (struct)
  topics: string[] = []; // deferred (array)
}

const SRC =
  '{"id":1,"name":"json-as","owner":{"login":"JairusSW","id":7},"topics":["wasm","json"]}';

const repo = JSON.parse<Repo>(SRC);
console.log("id     = " + repo.id.toString()); // eager
console.log("owner  = " + repo.owner.login); // deferred -> parsed on read
console.log("topics = " + repo.topics[0]); // deferred -> parsed on read

// untouched fields pass through their original bytes verbatim
console.log("rt     = " + JSON.stringify(JSON.parse<Repo>(SRC)));
