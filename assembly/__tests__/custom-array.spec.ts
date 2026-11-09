// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "..";
import { describe, expect } from "as-test";
import { deserializeStaticArray } from "../deserialize/naive/staticarray";


@json
class Point {
  constructor(
    public x: f64 = 0,
    public y: f64 = 0,
  ) {}


  @serializer("string")
  serialize(self: Point): string {
    return JSON.stringify(`${self.x},${self.y}`);
  }


  @deserializer("string")
  deserialize(data: string): Point {
    const coordinates = JSON.parse<string>(data).split(",");
    return new Point(f64.parse(coordinates[0]), f64.parse(coordinates[1]));
  }
}


@json
class ObjectPayload {
  value: i32 = 0;
  text: string = "";
}


@json
class ObjectCodec {
  constructor(public value: i32 = 0) {}


  @serializer("object")
  serialize(self: ObjectCodec): string {
    return '{"value":' + self.value.toString() + "}";
  }


  @deserializer("object")
  deserialize(data: string): ObjectCodec {
    return new ObjectCodec(JSON.parse<ObjectPayload>(data).value);
  }
}


@json
class AnyCodec {
  constructor(public raw: string = "null") {}


  @serializer("any")
  serialize(self: AnyCodec): string {
    return self.raw;
  }


  @deserializer("any")
  deserialize(data: string): AnyCodec {
    return new AnyCodec(data);
  }
}


@json
class CustomArrays {
  points: Point[] = [];
  staticPoints: StaticArray<Point> = [];
  objects: ObjectCodec[] = [];
  values: AnyCodec[] = [];
  tail: i32 = 0;
}


@json
class NullableCustomArrays {
  points: (Point | null)[] = [];
  staticPoints: StaticArray<Point | null> = [];
}

// The public StaticArray entry point currently ignores `out`. Exercise the
// destination-taking implementation directly as well as public/field parsing.
function parseStaticInto<T extends StaticArray<any>>(input: string, out: T): T {
  const start = changetype<usize>(input);
  return deserializeStaticArray<T>(
    start,
    start + ((<usize>input.length) << 1),
    changetype<usize>(out),
  );
}

describe("Custom string codecs in fresh arrays", () => {
  const input = '["1.0,2.0","-3.5,4.25"]';
  const points = JSON.parse<Point[]>(input);
  expect(points.length).toBe(2);
  expect(JSON.stringify(points)).toBe(input);
  const staticPoints = JSON.parse<StaticArray<Point>>(input);
  expect(staticPoints.length).toBe(2);
  expect(JSON.stringify(staticPoints)).toBe(input);
  expect(JSON.stringify(JSON.parse<Point[]>("[]"))).toBe("[]");
  expect(JSON.stringify(JSON.parse<StaticArray<Point>>("[]"))).toBe("[]");
});

describe("Custom string codecs replace reused array elements", () => {
  const original = new Point(99, 99);
  const out = [original];
  const input = '["1.0,2.0","-3.5,4.25"]';
  const parsed = JSON.parse<Point[]>(input, out);
  expect(changetype<usize>(parsed)).toBe(changetype<usize>(out));
  expect(JSON.stringify(parsed)).toBe(input);
  expect(original.x).toBe(99);
  expect(original.y).toBe(99);
  expect(JSON.stringify(JSON.parse<Point[]>('["5.0,6.0"]', out))).toBe(
    '["5.0,6.0"]',
  );
  expect(JSON.stringify(JSON.parse<Point[]>("[]", out))).toBe("[]");
  expect(JSON.stringify(JSON.parse<Point[]>(input, out))).toBe(input);
});

describe("Custom string codecs resize reused static arrays", () => {
  const original = new Point(99, 99);
  let out: StaticArray<Point> = [original, original];
  const ptr = changetype<usize>(out);
  out = parseStaticInto<StaticArray<Point>>('["1.0,2.0","3.0,4.0"]', out);
  expect(changetype<usize>(out)).toBe(ptr);
  expect(JSON.stringify(out)).toBe('["1.0,2.0","3.0,4.0"]');
  expect(original.x).toBe(99);
  out = parseStaticInto<StaticArray<Point>>('["5.0,6.0"]', out);
  expect(JSON.stringify(out)).toBe('["5.0,6.0"]');
  out = parseStaticInto<StaticArray<Point>>("[]", out);
  expect(out.length).toBe(0);
  out = parseStaticInto<StaticArray<Point>>('["7.0,8.0","9.0,10.0"]', out);
  expect(JSON.stringify(out)).toBe('["7.0,8.0","9.0,10.0"]');
});

describe("Custom object codecs retain returned replacement instances", () => {
  const original = new ObjectCodec(99);
  const out = [original];
  const input = '[{"value":1},{"value":2}]';
  expect(JSON.stringify(JSON.parse<ObjectCodec[]>(input))).toBe(input);
  const parsed = JSON.parse<ObjectCodec[]>(input, out);
  expect(changetype<usize>(parsed)).toBe(changetype<usize>(out));
  expect(JSON.stringify(parsed)).toBe(input);
  expect(changetype<usize>(parsed[0]) == changetype<usize>(original)).toBe(
    false,
  );
  expect(original.value).toBe(99);
  expect(JSON.stringify(JSON.parse<ObjectCodec[]>('[{"value":3}]', out))).toBe(
    '[{"value":3}]',
  );
  let staticOut: StaticArray<ObjectCodec> = [original];
  staticOut = parseStaticInto<StaticArray<ObjectCodec>>(input, staticOut);
  expect(JSON.stringify(staticOut)).toBe(input);
  staticOut = parseStaticInto<StaticArray<ObjectCodec>>(
    '[{"value":4}]',
    staticOut,
  );
  expect(JSON.stringify(staticOut)).toBe('[{"value":4}]');
  expect(JSON.stringify(JSON.parse<StaticArray<ObjectCodec>>(input))).toBe(
    input,
  );
});

describe("Custom array elements respect quoted structural characters", () => {
  const input = '[{"value":1,"text":"} [ \\\" ,"},{"value":2,"text":"{ ]"}]';
  expect(JSON.stringify(JSON.parse<ObjectCodec[]>(input))).toBe(
    '[{"value":1},{"value":2}]',
  );
  expect(JSON.stringify(JSON.parse<StaticArray<ObjectCodec>>(input))).toBe(
    '[{"value":1},{"value":2}]',
  );
});

describe("Custom any codecs receive each complete JSON value shape", () => {
  const input =
    '["a,}\\\"[\\\\",-1.25e+2,true,false,null,[1,{"x":"]"}],{"x":["}",2]}]';
  const values = JSON.parse<AnyCodec[]>(input);
  expect(values.length).toBe(7);
  expect(JSON.stringify(values)).toBe(input);
  const staticValues = JSON.parse<StaticArray<AnyCodec>>(input);
  expect(staticValues.length).toBe(7);
  expect(JSON.stringify(staticValues)).toBe(input);
  const out = [new AnyCodec("99")];
  expect(JSON.stringify(JSON.parse<AnyCodec[]>(input, out))).toBe(input);
  expect(JSON.stringify(JSON.parse<AnyCodec[]>("[]", out))).toBe("[]");
});

describe("Custom array elements exclude separator whitespace", () => {
  const input = ' \n [ "1.0,2.0" , "3.0,4.0" ] \t ';
  expect(JSON.stringify(JSON.parse<Point[]>(input))).toBe(
    '["1.0,2.0","3.0,4.0"]',
  );
  expect(JSON.stringify(JSON.parse<StaticArray<Point>>(input))).toBe(
    '["1.0,2.0","3.0,4.0"]',
  );
  const values = JSON.parse<AnyCodec[]>(' [ 1 \t, true \n, null \r, "x" ] ');
  expect(JSON.stringify(values)).toBe('[1,true,null,"x"]');
});

describe("Custom nullable array elements preserve nulls", () => {
  const input = '[null,"1.0,2.0",null]';
  expect(JSON.stringify(JSON.parse<(Point | null)[]>(input))).toBe(input);
  expect(JSON.stringify(JSON.parse<StaticArray<Point | null>>(input))).toBe(
    input,
  );
});

describe("Custom arrays in generated fields use the custom codec", () => {
  const input =
    '{"points":["1.0,2.0"],"staticPoints":["3.0,4.0"],"objects":[{"value":5}],"values":[true,[1,2]],"tail":6}';
  const parsed = JSON.parse<CustomArrays>(input);
  expect(JSON.stringify(parsed)).toBe(input);
  const out = new CustomArrays();
  out.points = [new Point(99, 99)];
  out.staticPoints = [new Point(99, 99)];
  out.objects = [new ObjectCodec(99)];
  out.values = [new AnyCodec("99")];
  expect(JSON.stringify(JSON.parse<CustomArrays>(input, out))).toBe(input);
  const empty =
    '{"points":[],"staticPoints":[],"objects":[],"values":[],"tail":7}';
  expect(JSON.stringify(JSON.parse<CustomArrays>(empty, out))).toBe(empty);
  expect(JSON.stringify(JSON.parse<CustomArrays>(input, out))).toBe(input);
});

describe("Custom generated fields handle nullable values and reordered whitespace", () => {
  const input =
    '{ "staticPoints" : [ null, "3.0,4.0" ], "points" : [ "1.0,2.0", null ] }';
  const expected =
    '{"points":["1.0,2.0",null],"staticPoints":[null,"3.0,4.0"]}';
  expect(JSON.stringify(JSON.parse<NullableCustomArrays>(input))).toBe(
    expected,
  );
  const out = new NullableCustomArrays();
  out.points = [new Point(99, 99)];
  out.staticPoints = [new Point(99, 99)];
  expect(JSON.stringify(JSON.parse<NullableCustomArrays>(input, out))).toBe(
    expected,
  );
});

describe("Custom generated fields preserve escaped quotes and backslashes", () => {
  const values =
    '["a,}\\\"[\\\\tail",-1.25e+2,true,false,null,[1,{"x":"]"}],{"x":["}",2]}]';
  const input =
    '{ "tail" : 9, "values" : ' +
    values +
    ', "objects" : [], "staticPoints" : [], "points" : [] }';
  const expected =
    '{"points":[],"staticPoints":[],"objects":[],"values":' +
    values +
    ',"tail":9}';
  expect(JSON.stringify(JSON.parse<CustomArrays>(input))).toBe(expected);
  expect(
    JSON.stringify(JSON.parse<CustomArrays>(input, new CustomArrays())),
  ).toBe(expected);
});

// Strict builds additionally reject malformed inputs at the public boundary.
if (JSON_STRICT) {
  describe("Custom array parsing rejects trailing content", () => {
    expect((): void => {
      JSON.parse<ObjectCodec[]>('[{"value":1}]junk');
    }).toThrow();
    expect((): void => {
      JSON.parse<StaticArray<ObjectCodec>>('[{"value":1}]junk');
    }).toThrow();
    expect((): void => {
      JSON.parse<AnyCodec[]>("[1] [2]");
    }).toThrow();
  });
}

let relocatingItems = new Array<RelocatingCodec>();
let relocatedItems = false;


@json
class RelocatingCodec {
  constructor(public value: i32 = 0) {}


  @serializer("object")
  serialize(self: RelocatingCodec): string {
    if (!relocatedItems && self.value == 1) {
      relocatedItems = true;
      // Force a backing allocation change, then replace a not-yet-read item.
      relocatingItems.length = 4096;
      relocatingItems[1] = new RelocatingCodec(22);
      __collect();
    }
    return '{"value":' + self.value.toString() + "}";
  }
}

describe("Array serializers observe backing relocation between callbacks", () => {
  relocatingItems = [
    new RelocatingCodec(1),
    new RelocatingCodec(2),
    new RelocatingCodec(3),
  ];
  relocatedItems = false;
  const initialBase = relocatingItems.dataStart;
  const result = JSON.stringify(relocatingItems);
  expect(relocatedItems).toBe(true);
  expect(relocatingItems.dataStart != initialBase).toBe(true);
  expect(result).toBe('[{"value":1},{"value":22},{"value":3}]');
});

let generatedItems = new Array<GeneratedEnvelope | null>();
let generatedItemsMoved = false;


@json
class CollectingChildCodec {
  constructor(public value: i32 = 0) {}


  @serializer("string")
  serialize(self: CollectingChildCodec): string {
    if (!generatedItemsMoved && self.value == 1) {
      generatedItemsMoved = true;
      generatedItems.length = 4096;
      // Remove the caller's reference to the object currently being written.
      generatedItems[0] = null;
      generatedItems[1] = new GeneratedEnvelope(22);
      __collect();
      const pressure = new Array<string>();
      for (let i = 0; i < 128; i++) pressure.push("pressure-" + i.toString());
      __collect();
    }
    return JSON.stringify("child-" + self.value.toString());
  }
}


@json
class GeneratedEnvelope {
  lead: string;
  child: CollectingChildCodec;
  tail: string;

  constructor(value: i32 = 0) {
    this.lead = "lead-" + value.toString();
    this.child = new CollectingChildCodec(value);
    this.tail = "tail-" + value.toString();
  }
}

describe("Generated element writers stay rooted across nested custom serializers", () => {
  generatedItems = [
    new GeneratedEnvelope(1),
    new GeneratedEnvelope(2),
    null,
    new GeneratedEnvelope(3),
  ];
  generatedItemsMoved = false;
  const initialBase = generatedItems.dataStart;
  const result = JSON.stringify(generatedItems);
  const expected =
    '[{"lead":"lead-1","child":"child-1","tail":"tail-1"},' +
    '{"lead":"lead-22","child":"child-22","tail":"tail-22"},null,' +
    '{"lead":"lead-3","child":"child-3","tail":"tail-3"}]';
  expect(generatedItemsMoved).toBe(true);
  expect(generatedItems.dataStart != initialBase).toBe(true);
  expect(generatedItems[0] === null).toBe(true);
  expect(result).toBe(expected);
  expect(JSON.stringify<i32[]>([9, 8])).toBe("[9,8]");
  __collect();
  expect(result).toBe(expected);
});
