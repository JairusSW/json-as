import { JSON } from ".";

// Scratch file for exploring json-as. `npm run pg` builds (always dumping the
// transformed source to assembly/playground.tmp.ts via JSON_WRITE) and runs it
// under wasmtime, so console.log output shows up immediately.

@json
class Inner {
  a: string = "";
  b: i32 = 0;
}


@json
class Demo {
  name: string = "demo";
  // omit when null — decided from the stored slice, no parse
  @omitnull owner: JSON.Lazy<Inner | null> = null;
  // omit when the predicate is true
  @omitif((self: Demo) => self.count == 0) count: JSON.Lazy<i32> = 0;
}

const src = '{"name":"x","owner":{"a":"hi","b":7},"count":5}';
const d = JSON.parse<Demo>(src);
console.log("name        = " + d.name);
console.log("round-trip  = " + JSON.stringify(d));

const empty = new Demo(); // owner=null, count=0
console.log("empty       = " + JSON.stringify(empty)); // both omitted
