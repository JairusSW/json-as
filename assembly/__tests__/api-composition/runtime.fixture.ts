import { JSON } from "../..";
let calls: i32 = 0;


@json class NumberCodec {
  value: i32 = -9;


  @deserializer("number") decode(_source: string): NumberCodec {
    calls++;
    const out = new NumberCodec();
    out.value = 99;
    return out;
  }
}


@json class TextCodec {
  value: i32 = -9;


  @deserializer("string") decode(_source: string): TextCodec {
    calls++;
    const out = new TextCodec();
    out.value = 99;
    return out;
  }
}


@json class ListCodec {
  value: i32 = -9;


  @deserializer("array") decode(_source: string): ListCodec {
    calls++;
    const out = new ListCodec();
    out.value = 99;
    return out;
  }
}


@json class ObjectCodec {
  value: i32 = -9;


  @deserializer("object") decode(_source: string): ObjectCodec {
    calls++;
    const out = new ObjectCodec();
    out.value = 99;
    return out;
  }
}


@json class BoolCodec {
  value: i32 = -9;


  @deserializer("boolean") decode(_source: string): BoolCodec {
    calls++;
    const out = new BoolCodec();
    out.value = 99;
    return out;
  }
}


@json class NilCodec {
  value: i32 = -9;


  @deserializer("null") decode(_source: string): NilCodec {
    calls++;
    const out = new NilCodec();
    out.value = 99;
    return out;
  }
}


@json class ConcreteBool {
  value: BoolCodec = new BoolCodec();
}


@json class ConcreteNull {
  value: NilCodec = new NilCodec();
}


@json class Generic<T> {
  value!: T;
}


@json class NullableSet {
  value: Set<i32> | null = null;
  tail: i32 = 0;
}


@json class NullableStatic {
  value: StaticArray<i32> | null = null;
  tail: i32 = 0;
}


@json class Buffers {
  value: ArrayBuffer[] = [];
}
let constructions: i32 = 0;
class Values extends Array<JSON.Value> {
  constructor() {
    super();
    constructions++;
  }
}
function actualType(value: usize): u32 {
  return load<u32>(value - 8);
}
export function run(kind: i32, reuse: bool): string {
  calls = 0;
  if (kind == 0) {
    const out = JSON.parse<Generic<NumberCodec>>(
      '{"value":7}',
      reuse ? new Generic<NumberCodec>() : changetype<Generic<NumberCodec>>(0),
    );
    return out.value.value.toString() + ":" + calls.toString();
  }
  if (kind == 1) {
    const out = JSON.parse<Generic<TextCodec>>(
      '{"value":"seven"}',
      reuse ? new Generic<TextCodec>() : changetype<Generic<TextCodec>>(0),
    );
    return out.value.value.toString() + ":" + calls.toString();
  }
  if (kind == 2) {
    const out = JSON.parse<Generic<ListCodec>>(
      '{"value":[7]}',
      reuse ? new Generic<ListCodec>() : changetype<Generic<ListCodec>>(0),
    );
    return out.value.value.toString() + ":" + calls.toString();
  }
  if (kind == 3) {
    const out = JSON.parse<Generic<ObjectCodec>>(
      '{"value":{"n":7}}',
      reuse ? new Generic<ObjectCodec>() : changetype<Generic<ObjectCodec>>(0),
    );
    return out.value.value.toString() + ":" + calls.toString();
  }
  if (kind == 4) {
    const out = JSON.parse<Generic<BoolCodec>>(
      '{"value":true}',
      reuse ? new Generic<BoolCodec>() : changetype<Generic<BoolCodec>>(0),
    );
    return out.value.value.toString() + ":" + calls.toString();
  }
  if (kind == 5) {
    const out = JSON.parse<Generic<NilCodec>>(
      '{"value":null}',
      reuse ? new Generic<NilCodec>() : changetype<Generic<NilCodec>>(0),
    );
    return out.value.value.toString() + ":" + calls.toString();
  }
  if (kind == 6) {
    const out = new Generic<Date>();
    out.value = new Date(0);
    const value = JSON.parse<Generic<Date>>(
      '{"value":"1970-01-02T00:00:00.000Z"}',
      reuse ? out : changetype<Generic<Date>>(0),
    );
    return value.value.getTime().toString();
  }
  if (kind == 7) {
    const out = new Generic<Set<i32>>();
    out.value = new Set<i32>();
    const value = JSON.parse<Generic<Set<i32>>>(
      '{"value":[1,2]}',
      reuse ? out : changetype<Generic<Set<i32>>>(0),
    );
    return JSON.stringify(value.value);
  }
  if (kind == 8) {
    const out = new NullableSet();
    out.value = new Set<i32>();
    out.value!.add(8);
    const value = JSON.parse<NullableSet>(
      '{"value":null,"tail":9}',
      reuse ? out : changetype<NullableSet>(0),
    );
    return JSON.stringify(value);
  }
  if (kind == 9) {
    const out = new NullableStatic();
    out.value = [8];
    const value = JSON.parse<NullableStatic>(
      '{"value":null,"tail":9}',
      reuse ? out : changetype<NullableStatic>(0),
    );
    return JSON.stringify(value);
  }
  if (kind == 10)
    return JSON.stringify(
      JSON.parse<ArrayBuffer[]>(
        "[[1,2],[3]]",
        reuse ? new Array<ArrayBuffer>() : changetype<ArrayBuffer[]>(0),
      ),
    );
  if (kind == 11)
    return JSON.stringify(
      JSON.parse<(ArrayBuffer | null)[]>(
        "[null,[1,2]]",
        reuse
          ? new Array<ArrayBuffer | null>()
          : changetype<(ArrayBuffer | null)[]>(0),
      ),
    );
  if (kind == 12)
    return JSON.stringify(JSON.parse<StaticArray<ArrayBuffer>>("[[1,2],[3]]"));
  if (kind == 13)
    return JSON.stringify(
      JSON.parse<Buffers>(
        '{"value":[[1,2],[3]]}',
        reuse ? new Buffers() : changetype<Buffers>(0),
      ),
    );
  if (kind == 14 || kind == 15) {
    const source = JSON.parse<JSON.Value>(kind == 14 ? '{"n":1}' : "[1]");
    if (reuse) {
      if (kind == 14) source.get<JSON.Obj>();
      else source.get<JSON.Arr>();
    }
    const copy = JSON.Value.empty();
    copy.set(source);
    if (kind == 14) source.get<JSON.Obj>().set<f64>("n", 2);
    else source.get<JSON.Arr>().push<f64>(2);
    return JSON.stringify(copy);
  }
  if (kind == 20) {
    const value = JSON.parse<ConcreteBool>('{"value":false}');
    return value.value.value.toString() + ":" + calls.toString();
  }
  if (kind == 21) {
    const value = JSON.parse<ConcreteNull>('{"value":null}');
    return value.value.value.toString() + ":" + calls.toString();
  }
  if (kind == 22) {
    const value = JSON.parse<Generic<BoolCodec>>('{"value":false}');
    return value.value.value.toString() + ":" + calls.toString();
  }
  if (kind >= 23) {
    let value: Values;
    if (kind == 23) value = JSON.parse<Values>("[2]");
    else if (kind == 24) value = JSON.parse<Values[]>("[[2]]")[0];
    else if (kind == 25) value = JSON.parse<StaticArray<Values>>("[[2]]")[0];
    else value = JSON.parse<Values[]>("[[2]]", new Array<Values>())[0];
    return (
      actualType(changetype<usize>(value)) == idof<Values>() &&
      value.length == 1 &&
      value[0].get<f64>() == 2
    ).toString();
  }
  const original = new Values();
  original.push(JSON.Value.from<i32>(2));
  const boxed = JSON.Value.from(original);
  const object = new JSON.Obj();
  object.set("values", original);
  const array = new JSON.Arr();
  array.push(original);
  constructions = 0;
  let restored: Values;
  if (kind == 16) restored = boxed.get<Values>();
  else if (kind == 17) restored = boxed.as<Values>();
  else if (kind == 18) restored = object.getAs<Values>("values");
  else restored = array.getAs<Values>(0);
  return (
    actualType(changetype<usize>(restored)) == idof<Values>() &&
    constructions == 1 &&
    restored.length == 1 &&
    restored[0].get<i32>() == 2
  ).toString();
}
