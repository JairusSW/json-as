import { JSON } from "..";
import { Runtime } from "shared/runtime";
import { initializeCursorObject } from "../deserialize/cursor-value";

@json
class Leaf {
  count!: i32;
  score!: f64;
  active!: bool;
  label!: string;
  note!: string | null;
}

@json
class Graph {
  title!: string;
  child!: Leaf;
  children!: Leaf[];
  lookup!: Map<string, Leaf>;
  tags!: Set<string>;
}

let calls = 0;
function observableDefault(): i32 {
  calls++;
  if (ASC_RUNTIME == Runtime.Incremental) __collect();
  return 7;
}

@json
class Observable {
  count: i32 = observableDefault();
  label: string = "declared";
}

@json
class Parent {
  title!: string;
  child!: Observable;
  children!: Graph[];
}

let completionCalls = 0;
@json
class CustomCompletion {
  label!: string;
  __FINALIZE_CURSOR(): void {
    completionCalls++;
  }
}

@json
class ImplicitBase {
  base!: string;
}

@json
class DeclaredDerived extends ImplicitBase {
  count: i32 = observableDefault();
}

@json
class DerivedParent {
  child!: DeclaredDerived;
  hook!: CustomCompletion;
}

let cursorInitializerCalls = 0;
@json
class ManualCursorBase {
  label!: string;
  __INITIALIZE_CURSOR(): this {
    cursorInitializerCalls++;
    this.label = "manual";
    return this;
  }
}

@json
class ManualCursorDerived extends ManualCursorBase {
  count!: i32;
}

@json
class ManualCursorParent {
  child!: ManualCursorDerived;
}

let checks = 0;
function check(value: bool): void {
  assert(value);
  checks++;
}

function checkLeaf(value: Leaf): void {
  check(value.count == 0);
  check(value.score == 0);
  check(!value.active);
  check(value.label == "");
  check(value.note == null);
}

export function run(): i32 {
  checks = 0;
  check(JSON.__cursorSupports<Graph>());
  const type = changetype<Leaf>(0);
  // @ts-expect-error: generated fresh-construction capability
  check(isDefined(type.__INITIALIZE_CURSOR_FRESH));
  const explicit = changetype<Observable>(0);
  // All types have their own entry; observable defaults delegate to normal init.
  // @ts-expect-error: generated fresh construction entry
  check(isDefined(explicit.__INITIALIZE_CURSOR_FRESH));

  // Minimal/stub raw allocation may return dirty payloads. Poison a fresh
  // allocation without allocating/collecting in between, then exercise the
  // same helper used by public parsing before any child can collect.
  const raw = changetype<Leaf>(__new(offsetof<Leaf>(), idof<Leaf>()));
  if (ASC_RUNTIME != Runtime.Incremental) {
    memory.fill(changetype<usize>(raw), 0xa5, offsetof<Leaf>());
  }
  initializeCursorObject(raw);
  // @ts-expect-error: generated missing-field completion
  raw.__FINALIZE_CURSOR();
  checkLeaf(raw);

  const canonical = JSON.parse<Leaf>(
    '{"count":1,"score":2,"active":true,"label":"hot","note":"x"}',
  );
  check(canonical.count == 1 && canonical.label == "hot" && canonical.note == "x");
  const spaced = JSON.parse<Leaf>(
    '{"count" :1,"score" :2,"active" :true,"label" :"cursor","note" :"x"}',
  );
  check(spaced.count == 1 && spaced.label == "cursor" && spaced.note == "x");
  const partial = JSON.parse<Leaf>('{"count":1,"score":2,"active":true}');
  check(partial.label == "" && partial.note == null);
  completionCalls = 0;
  check(JSON.parse<CustomCompletion>('{"label":"hook"}').label == "hook");
  check(completionCalls == 1);
  calls = 0;
  const derived = JSON.parse<DeclaredDerived>('{"base":"derived"}');
  check(calls == 1);
  check(derived.count == 7 && derived.base == "derived");
  calls = 0;
  completionCalls = 0;
  const defaulted = JSON.parse<DerivedParent>("{}");
  check(calls == 1 && defaulted.child.count == 7 && defaulted.child.base == "");
  check(completionCalls == 0 && defaulted.hook.label == "");
  cursorInitializerCalls = 0;
  const manual = JSON.parse<ManualCursorDerived>('{"count":9}');
  check(cursorInitializerCalls == 1 && manual.count == 9 && manual.label == "manual");
  cursorInitializerCalls = 0;
  const ordinary = JSON.parse<ManualCursorParent>("{}");
  check(cursorInitializerCalls == 0 && ordinary.child.count == 0 && ordinary.child.label == "");

  const retained = new Array<Graph>();
  for (let i = 0; i < 48; i++) {
    const empty = JSON.parse<Graph>("{}");
    check(empty.title == "");
    checkLeaf(empty.child);
    check(empty.children.length == 0);
    check(empty.lookup.size == 0);
    check(empty.tags.size == 0);
    empty.child.label = "owned";
    retained.push(empty);
    const value = JSON.parse<Leaf>(
      '{"label":"first","count":4,"label":"last","note":null}',
    );
    check(value.label == "last");
    check(value.count == 4);
    check(value.note == null);
    check(value.score == 0);
    check(!value.active);
    if (ASC_RUNTIME == Runtime.Incremental) __collect();
  }
  for (let i = 0; i < retained.length; i++) {
    check(retained[i].child.label == "owned");
    check(retained[i].title == "");
    if (i != 0) {
      check(retained[i].child !== retained[0].child);
      check(retained[i].children !== retained[0].children);
    }
  }

  calls = 0;
  const parent = JSON.parse<Parent>(
    '{"children":[{},{}],"child":{"count":42},"title":"kept"}',
  );
  check(calls == 2);
  check(parent.child.count == 42);
  check(parent.child.label == "declared");
  check(parent.children.length == 2);
  checkLeaf(parent.children[0].child);
  checkLeaf(parent.children[1].child);
  if (ASC_RUNTIME == Runtime.Incremental) __collect();
  check(parent.title == "kept");
  calls = 0;
  const missing = JSON.parse<Parent>("{}");
  check(calls == 1);
  check(missing.child.count == 7);
  check(missing.title == "");

  const out = JSON.parse<Leaf>('{"label":"old","count":8}');
  const reused = JSON.parse<Leaf>('{"label":"new","count":9}', out);
  check(reused === out);
  check(reused.label == "new");
  check(reused.count == 9);
  return checks;
}
