import { bench, blackbox, settings, suite } from "as-bench/assembly/index";
import { JSON } from "..";

settings.warmupTime = 500;
settings.measurementTime = 1000;


@json
class ProfileObject {
  id: u32 = 4_294_967_295;
  active: bool = true;
  score: f64 = 3.1415926535;
  name: string = "profile-object";
  escaped: string = 'plain prefix with an escaped quote: " and slash: \\';
  values: i32[] = [1, -22, 333, -4444, 55555, -666666, 7777777];
  tags: string[] = ["alpha", "beta", "gamma", "delta"];
}

const source =
  '{"id":4294967295,"active":true,"score":3.1415926535,"name":"profile-object","escaped":"plain prefix with an escaped quote: \\" and slash: \\\\","values":[1,-22,333,-4444,55555,-666666,7777777],"tags":["alpha","beta","gamma","delta"]}';
const sourceStart = changetype<usize>(source);
const sourceEnd = sourceStart + (source.length << 1);
const reused = JSON.parse<ProfileObject>(source);


@inline
function deserializeInto(out: ProfileObject): void {
  // @ts-ignore: supplied by the json-as transform
  if (isDefined(out.__DESERIALIZE_FAST)) {
    // @ts-ignore: supplied by the json-as transform
    out.__DESERIALIZE_FAST(sourceStart, sourceEnd, out);
  } else {
    // @ts-ignore: supplied by the json-as transform
    out.__DESERIALIZE_SLOW(sourceStart, sourceEnd, out);
  }
}

suite("generated object", () => {
  bench("deserialize reused", () => {
    for (let i = 0; i < 64; i++) deserializeInto(reused);
    blackbox(reused.id);
  });

  bench("deserialize allocating", () => {
    for (let i = 0; i < 64; i++) blackbox(JSON.parse<ProfileObject>(source));
  });

  bench("serialize", () => {
    for (let i = 0; i < 64; i++) blackbox(JSON.stringify(reused));
  });
});

const plainString =
  '"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.~ repeated plain payload abcdefghijklmnopqrstuvwxyz"';
const escapedString =
  '"plain prefix with \\n newline, \\t tab, \\\" quote, \\\\ slash, and unicode \\u263a suffix"';

suite("strings", () => {
  bench("deserialize plain", () => {
    for (let i = 0; i < 256; i++) blackbox(JSON.parse<string>(plainString));
  });

  bench("deserialize escaped", () => {
    for (let i = 0; i < 256; i++) blackbox(JSON.parse<string>(escapedString));
  });

  bench("serialize plain", () => {
    for (let i = 0; i < 256; i++) blackbox(JSON.stringify(plainString));
  });
});


@json
class ProfileCanadaProperties {
  name: string = "";
}


@json
class ProfileCanadaGeometry {
  type: string = "";
  coordinates: f64[][][] = [];
}


@json
class ProfileCanadaFeature {
  type: string = "";
  properties: ProfileCanadaProperties = new ProfileCanadaProperties();
  geometry: ProfileCanadaGeometry = new ProfileCanadaGeometry();
}


@json
class ProfileCanada {
  type: string = "";
  features: ProfileCanadaFeature[] = [];
}

const canadaSource =
  '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"A"},"geometry":{"type":"Polygon","coordinates":[[[-65.61361699999998,43.42027300000001],[-65.61972000000001,43.418052999999986],[-65.625,43.42249299999999],[-65.61361699999998,43.42027300000001]]]}},{"type":"Feature","properties":{"name":"B"},"geometry":{"type":"MultiPolygon","coordinates":[[[-72.0,45.0],[-71.5,45.25],[-71.0,45.0],[-72.0,45.0]]]} }]}';
const canadaStart = changetype<usize>(canadaSource);
const canadaEnd = canadaStart + (canadaSource.length << 1);
const canadaReused = JSON.parse<ProfileCanada>(canadaSource);

suite("canada shape", () => {
  bench("deserialize reused", () => {
    for (let i = 0; i < 16; i++) {
      // @ts-ignore: supplied by the json-as transform
      canadaReused.__DESERIALIZE_FAST(canadaStart, canadaEnd, canadaReused);
    }
    blackbox(canadaReused.features.length);
  });
});
