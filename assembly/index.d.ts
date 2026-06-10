/**
 * Options for the {@link json} class decorator: `@json({ ... })`.
 */
declare class JSONConfig {
  /**
   * Class-level lazy (on-demand) parsing mode. A lazy field stores its raw JSON
   * slice at parse time and only parses it into the field's type on first
   * access; untouched fields pass their original bytes straight through on
   * serialize.
   *
   * - `"none"` *(default)* - every field is parsed eagerly, up-front.
   * - `"auto"` - the transform defers fields whose estimated parse cost is high
   *   (nested structs, arrays, maps, long strings) and keeps cheap fields
   *   (primitives, enums, `Date`) eager. Use `@eager` to force a field back to
   *   eager, or `@lazy` to force one on.
   * - `"all"` - every field is deferred. Best for proxy / filter / forward
   *   workloads over large payloads; note it generates a getter and a serialize
   *   branch per field, so module size grows with very wide schemas.
   *
   * @example
   * ```ts
   * @json({ lazy: "auto" })
   * class Repo {
   *   name: string = "";        // cheap -> stays eager
   *   owner: Owner = new Owner; // costly -> deferred
   *   @eager id: i32 = 0;       // opt back out
   * }
   * ```
   */
  lazy?: "none" | "auto" | "all";
}

/**
 * Marks a class as serializable, generating the (de)serialization methods the
 * runtime needs. Required on every type passed to `JSON.parse` / `JSON.stringify`
 * (including nested types).
 *
 * @param config - Optional {@link JSONConfig} (currently `{ lazy }`).
 *
 * @example
 * ```ts
 * @json
 * class Vec3 {
 *   x: f64 = 0;
 *   y: f64 = 0;
 *   z: f64 = 0;
 * }
 *
 * JSON.stringify(new Vec3());       // '{"x":0.0,"y":0.0,"z":0.0}'
 * JSON.parse<Vec3>('{"x":1,"y":2,"z":3}');
 * ```
 */
declare function json(config?: JSONConfig): Function;
// @ts-expect-error: type
declare function json(..._): void;
/**
 * Alias for {@link json}. `@serializable` and `@json` are interchangeable.
 */
// @ts-ignore: type
declare function serializable(..._): void;

/**
 * Field decorator that overrides the JSON key used for a property, decoupling
 * the wire name from the AssemblyScript field name.
 *
 * @param newName - The key to emit and read for this field.
 *
 * @example
 * ```ts
 * @json
 * class User {
 *   @alias("user_id") userId: i32 = 0; // <-> {"user_id": 0}
 * }
 * ```
 */
declare function alias(newName: string): Function;

/**
 * Field decorator that excludes a property from JSON entirely: it is never
 * serialized and is ignored during parsing.
 *
 * @example
 * ```ts
 * @json
 * class Session {
 *   token: string = "";
 *   @omit secret: string = ""; // never (de)serialized
 * }
 * ```
 */
// @ts-ignore: type
declare function omit(..._): void;

/**
 * Field decorator that omits a property from the output when a predicate holds.
 * The field is still parsed normally; the condition only affects serialization.
 *
 * @param condition - A predicate that receives the **instance** and returns
 *   `true` to omit the field - `(self: T) => boolean` - or a string expression
 *   evaluated in the instance's scope (reference fields via `this`).
 *
 * @example
 * ```ts
 * @json
 * class Player {
 *   age: i32 = 0;
 *   @omitif((self: Player) => self.age < 18) email: string = ""; // arrow form
 *   @omitif("this.age < 18") phone: string = "";                 // string form
 * }
 * ```
 */
declare function omitif(condition: string | ((self: any) => boolean)): Function;

/**
 * Field decorator that omits a property from the output when its value is
 * `null`. Shorthand for the common nullable case; the field is still parsed.
 *
 * @example
 * ```ts
 * @json
 * class Profile {
 *   @omitnull bio: string | null = null; // key absent when null
 * }
 * ```
 */
// @ts-ignore: type
declare function omitnull(..._): void;

/**
 * Field decorator that marks a property as optional for deserialization: the
 * key may be absent from (or appear anywhere in) the input, and the field keeps
 * its default. Unlike `@omitnull`/`@omitif` it does NOT omit the field on
 * serialize and has no nullability requirement - it only opts the field into
 * the order-tolerant fast path.
 *
 * @example
 * ```ts
 * @json
 * class Tweet {
 *   @optional retweeted_status: Retweet | null = null; // key may be absent
 * }
 * ```
 */
// @ts-ignore: type
declare function optional(..._): void;

/**
 * Field decorator that defers parsing of a property until it is first read
 * (on-demand / lazy parsing). The raw JSON slice is stored at parse time and
 * materialized into the field's type on first access, then cached; an untouched
 * field round-trips by copying its original bytes - never re-parsed or
 * re-serialized.
 *
 * Equivalent to the `JSON.Lazy<T>` type-wrapper form. Pays off for fields you
 * usually skip or forward; reading a deferred field is a one-time cost.
 *
 * @example
 * ```ts
 * @json
 * class Repo {
 *   name: string = "";              // eager
 *   @lazy owner: Owner = new Owner; // parsed only when `repo.owner` is read
 * }
 * ```
 */
// @ts-ignore: type
declare function lazy(..._): void;

/**
 * Field decorator that forces a property to be parsed eagerly, opting it out of
 * class-level lazy deferral (`@json({ lazy: "auto" | "all" })`). No effect on a
 * class that is not lazy.
 *
 * @example
 * ```ts
 * @json({ lazy: "all" })
 * class Event {
 *   @eager id: i32 = 0;             // always parsed up-front
 *   payload: Payload = new Payload; // deferred
 * }
 * ```
 */
// @ts-ignore: type
declare function eager(..._): void;

/**
 * Method decorator marking a member as the class's custom serializer, replacing
 * the generated serialization. The method receives the instance and must return
 * a **valid JSON string**. Pair with {@link deserializer}.
 *
 * @param shape - Optional JSON value shape the output conforms to - one of
 *   `"any"` (default), `"string"`, `"number"`, `"object"`, `"array"`,
 *   `"boolean"`, or `"null"`.
 *
 * @example
 * ```ts
 * @json
 * class Point {
 *   x: f64 = 0;
 *   y: f64 = 0;
 *   constructor(x: f64, y: f64) {
 *     this.x = x;
 *     this.y = y;
 *   }
 *
 *   // Serialize a Point to a single JSON string.
 *   @serializer("string")
 *   serializer(self: Point): string {
 *     return JSON.stringify(`${self.x},${self.y}`);
 *   }
 *
 *   // ...and back. Always return a fresh instance.
 *   @deserializer("string")
 *   deserializer(data: string): Point {
 *     const raw = JSON.parse<string>(data);
 *     const c = raw.indexOf(",");
 *     return new Point(f64.parse(raw.slice(0, c)), f64.parse(raw.slice(c + 1)));
 *   }
 * }
 *
 * JSON.stringify(new Point(3.5, -9.2)); // '"3.5,-9.2"'
 * JSON.parse<Point>('"3.5,-9.2"'); // Point { x: 3.5, y: -9.2 }
 * ```
 */
// @ts-ignore: type
declare function serializer(
  shape?: "any" | "string" | "number" | "object" | "array" | "boolean" | "null",
): any;

/**
 * Method decorator marking a member as the class's custom deserializer,
 * replacing the generated deserialization. The method receives the raw JSON
 * string and must return a **new** instance - never assume an existing
 * destination is reused. Pair with {@link serializer} (see it for a full,
 * round-tripping example).
 *
 * @param shape - Optional JSON value shape the input conforms to - one of
 *   `"any"` (default), `"string"`, `"number"`, `"object"`, `"array"`,
 *   `"boolean"`, or `"null"`.
 *
 * @example
 * ```ts
 * @deserializer("string")
 * deserializer(data: string): Point {
 *   const raw = JSON.parse<string>(data); // unwrap the JSON string
 *   const c = raw.indexOf(",");
 *   return new Point(f64.parse(raw.slice(0, c)), f64.parse(raw.slice(c + 1)));
 * }
 * ```
 */
// @ts-ignore: type
declare function deserializer(
  shape?: "any" | "string" | "number" | "object" | "array" | "boolean" | "null",
): any;

/**
 * The active {@link JSONMode}, injected by the transform from the `JSON_MODE`
 * build-time environment variable (default `SWAR`). Set it on the `asc`
 * command/build env; `SIMD` additionally requires `--enable simd`.
 *
 * @example
 * ```sh
 * JSON_MODE=SIMD  asc app.ts --transform json-as/transform --enable simd
 * JSON_MODE=SWAR  asc app.ts --transform json-as/transform   # default
 * JSON_MODE=NAIVE asc app.ts --transform json-as/transform
 * ```
 */
declare const JSON_MODE: JSONMode;

/**
 * Whether the string cache is enabled (default off). Injected from the
 * `JSON_CACHE` build-time environment variable. When on, repeated strings are
 * reused to speed up string-heavy serialization.
 *
 * @example
 * ```sh
 * JSON_CACHE=true  asc app.ts --transform json-as/transform # default size
 * JSON_CACHE=512kb asc app.ts --transform json-as/transform # enable + size
 * JSON_CACHE=false asc app.ts --transform json-as/transform # off (default)
 * ```
 */
declare const JSON_CACHE: bool;

/**
 * The string-cache size in bytes when {@link JSON_CACHE} is enabled. Both this
 * and {@link JSON_CACHE} are derived from the single `JSON_CACHE` build-time
 * environment variable, which accepts raw bytes (`JSON_CACHE=1048576`), bit
 * units (`512kb`, `2mb`, `1gb`), or byte units (`64KB`, `2MB`, `1GB`).
 *
 * @example
 * ```sh
 * JSON_CACHE=1mb asc app.ts --transform json-as/transform # JSON_CACHE_SIZE == 1048576
 * ```
 */
declare const JSON_CACHE_SIZE: usize;
