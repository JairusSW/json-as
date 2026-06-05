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
   * - `"none"` *(default)* — every field is parsed eagerly, up-front.
   * - `"auto"` — the transform defers fields whose estimated parse cost is high
   *   (nested structs, arrays, maps, long strings) and keeps cheap fields
   *   (primitives, enums, `Date`) eager. Use `@eager` to force a field back to
   *   eager, or `@lazy` to force one on.
   * - `"all"` — every field is deferred. Best for proxy / filter / forward
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
// @ts-ignore: type
declare function json(config?: JSONConfig): Function;

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
 *   `true` to omit the field — `(self: T) => boolean` — or a string expression
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
declare function omitnull(..._): Function;

/**
 * Field decorator that defers parsing of a property until it is first read
 * (on-demand / lazy parsing). The raw JSON slice is stored at parse time and
 * materialized into the field's type on first access, then cached; an untouched
 * field round-trips by copying its original bytes — never re-parsed or
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
 * Method decorator marking a member as the class's custom serializer. The
 * method receives the instance and returns the JSON string for it, replacing
 * the generated serialization. Pairs with {@link deserializer}.
 */
// @ts-ignore: type
declare function serializer(..._): any;

/**
 * Method decorator marking a member as the class's custom deserializer. The
 * method receives the JSON string and returns an instance, replacing the
 * generated deserialization. Pairs with {@link serializer}.
 */
// @ts-ignore: type
declare function deserializer(..._): any;

/**
 * Parsing/serialization strategy selected at build time via the `JSON_MODE`
 * environment variable and exposed as {@link JSON_MODE}.
 */
declare enum JSONMode {
  /** Scalar/word-at-a-time (SWAR) scanning. The default; no extra flags. */
  SWAR = 0,
  /** 128-bit SIMD scanning. Fastest on larger payloads; needs `--enable simd`. */
  SIMD = 1,
  /** Straightforward byte-at-a-time scanning. Smallest code, slowest. */
  NAIVE = 2,
}

/**
 * The active {@link JSONMode}, injected by the transform from the `JSON_MODE`
 * build-time environment variable (default `SWAR`).
 */
declare const JSON_MODE: JSONMode;

/**
 * Whether the string cache is enabled, injected from the `JSON_CACHE`
 * environment variable. When on, repeated strings can be reused to speed up
 * string-heavy serialization.
 */
declare const JSON_CACHE: bool;

/**
 * The string-cache size in bytes when {@link JSON_CACHE} is enabled, injected
 * from the `JSON_CACHE` environment variable (accepts raw bytes, `512kb`,
 * `2mb`, `1gb`, etc.).
 */
declare const JSON_CACHE_SIZE: usize;
