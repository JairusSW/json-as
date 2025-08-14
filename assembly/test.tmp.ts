import {
  JSON
} from ".";
const o = new JSON.Obj();
o.set("schema", "http://json-schema.org/draft-07/schema#");
o.set("additionalProperties", false);
o.set("properties", new JSON.Obj());
o.get("properties")!.as<JSON.Obj>().set("duration", new JSON.Obj());
o.get("properties")!.as<JSON.Obj>().get("duration")!.as<JSON.Obj>().set("default", 10);
o.get("properties")!.as<JSON.Obj>().get("duration")!.as<JSON.Obj>().set("description", "Duration of the operation in seconds");
o.get("properties")!.as<JSON.Obj>().get("duration")!.as<JSON.Obj>().set("type", "number");
o.get("properties")!.as<JSON.Obj>().set("steps", new JSON.Obj());
o.get("properties")!.as<JSON.Obj>().get("steps")!.as<JSON.Obj>().set("default", 5);
o.get("properties")!.as<JSON.Obj>().get("steps")!.as<JSON.Obj>().set("description", "Number of steps in the operation");
o.get("properties")!.as<JSON.Obj>().get("steps")!.as<JSON.Obj>().set("type", "number");
o.set("type", "object");
console.log(o.toString());
console.log((o.toString().length << 1).toString() + " == 596");
