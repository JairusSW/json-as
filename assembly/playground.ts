import { JSON } from ".";


@json
class Owner {
  login: string = "";
  id: i32 = 0;
}


@json
class Repo {
  name!: string; // eager
  owner!: JSON.Lazy<Owner>; // typed/accessed as Owner, parsed only when read
}

const repo: Repo = {
  name: "foo",
  owner: {
    login: "bar",
    id: 97,
  },
};
const serialized = JSON.stringify(repo);
console.log(serialized);
const deserialized = JSON.parse<Repo>(serialized);
console.log("{");
console.log("  name: " + deserialized.name);
if (deserialized.owner !== null) {
  console.log("  owner: {");
  console.log("    login: " + deserialized.owner.login);
  console.log("    id: " + deserialized.owner.id.toString());
  console.log("  }");
} else {
  console.log("  owner: null");
}
console.log("  }");
console.log("}");
