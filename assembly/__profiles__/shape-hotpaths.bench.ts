import { bench, blackbox, settings, suite } from "as-bench/assembly/index";
import { JSON } from "..";

settings.warmupTime = 500;
settings.measurementTime = 1000;


@json
class ShapeSmall {
  authenticated: bool = true;
  user_id: i32 = 8472;
  username: string = "jairus";
  role: string = "admin";
  expires_at: string = "2025-12-23T04:30:00Z";
}

const smallValue = new ShapeSmall();
const smallSource = JSON.stringify(smallValue);
const smallObj = JSON.parse<JSON.Obj>(smallSource);

suite("shape small", () => {
  bench("serialize generated", () => {
    for (let i = 0; i < 256; i++) blackbox(JSON.stringify(smallValue));
  });

  bench("deserialize generated", () => {
    for (let i = 0; i < 256; i++) blackbox(JSON.parse<ShapeSmall>(smallSource));
  });

  bench("serialize obj", () => {
    for (let i = 0; i < 256; i++) blackbox(JSON.stringify(smallObj));
  });

  bench("deserialize obj", () => {
    for (let i = 0; i < 256; i++) blackbox(JSON.parse<JSON.Obj>(smallSource));
  });
});


@json
class ShapeVec3 {
  x: i32 = 1;
  y: i32 = 2;
  z: i32 = 3;
}

const vecValue = new ShapeVec3();
const vecSource = JSON.stringify(vecValue);
const vecObj = JSON.parse<JSON.Obj>(vecSource);

suite("shape vec3", () => {
  bench("serialize generated", () => {
    for (let i = 0; i < 512; i++) blackbox(JSON.stringify(vecValue));
  });

  bench("deserialize generated", () => {
    for (let i = 0; i < 512; i++) blackbox(JSON.parse<ShapeVec3>(vecSource));
  });

  bench("serialize obj", () => {
    for (let i = 0; i < 512; i++) blackbox(JSON.stringify(vecObj));
  });

  bench("deserialize obj", () => {
    for (let i = 0; i < 512; i++) blackbox(JSON.parse<JSON.Obj>(vecSource));
  });
});


@json
class ShapePreferences {
  theme: string = "dark";
  notifications: bool = true;
  language: string = "en-US";
  timezone: string = "America/Los_Angeles";
  privacy_level: string = "friends_only";
  two_factor_enabled: bool = false;
}


@json
class ShapeActivity {
  action: string = "starred";
  timestamp: string = "2025-12-22T10:15:00Z";
  target: string = "JairusSW/json-as";
}


@json
class ShapeMedium {
  id: i32 = 42;
  username: string = "jairus";
  full_name: string = "Jairus Tanaka";
  email: string = "me@jairus.dev";
  avatar_url: string = "https://avatars.githubusercontent.com/u/123456?v=4";
  bio: string =
    "I like compilers, elegant algorithms, bare metal, simd, and wasm.";
  website: string = "https://jairus.dev/";
  location: string = "Seattle, WA";
  joined_at: string = "2020-01-15T08:30:00Z";
  is_verified: bool = true;
  is_premium: bool = true;
  follower_count: i32 = 61;
  following_count: i32 = 39;
  preferences: ShapePreferences = new ShapePreferences();
  tags: string[] = [
    "typescript",
    "webassembly",
    "performance",
    "rust",
    "assemblyscript",
    "json",
  ];
  recent_activity: ShapeActivity[] = [
    new ShapeActivity(),
    new ShapeActivity(),
    new ShapeActivity(),
    new ShapeActivity(),
    new ShapeActivity(),
  ];
}

const mediumValue = new ShapeMedium();
const mediumSource = JSON.stringify(mediumValue);
const mediumObj = JSON.parse<JSON.Obj>(mediumSource);

suite("shape medium", () => {
  bench("serialize generated", () => {
    for (let i = 0; i < 32; i++) blackbox(JSON.stringify(mediumValue));
  });

  bench("deserialize generated", () => {
    for (let i = 0; i < 32; i++)
      blackbox(JSON.parse<ShapeMedium>(mediumSource));
  });

  bench("serialize obj", () => {
    for (let i = 0; i < 32; i++) blackbox(JSON.stringify(mediumObj));
  });

  bench("deserialize obj", () => {
    for (let i = 0; i < 32; i++) blackbox(JSON.parse<JSON.Obj>(mediumSource));
  });
});
