// Untimed observer only: callbacks count reclaimed objects and native frees.
import Base from "../lib/index.js";
import { SimpleParser } from "../lib/util.js";
import { Visitor } from "../lib/visitor.js";
export default class extends Base {
  afterParse(parser) {
    super.afterParse(parser);
    const rt = parser.sources.find((s) => s.internalPath === "~lib/rt/itcms");
    const defer = rt?.statements.find(
      (n) => n.body && n.name?.text.startsWith("__json_as_sweep_defer"),
    );
    const flush = rt?.statements.find(
      (n) => n.body && n.name?.text.startsWith("__json_as_sweep_flush"),
    );
    if (!defer || !flush) throw Error("Missing optimized sweep helpers");
    class Bind extends Visitor {
      _visit(n, p) {
        n.range = defer.range;
        super._visit(n, p);
      }
    }
    const bind = (n) => {
      new Bind().visit(n);
      return n;
    };
    const item = "__json_as_observe_sweep_item",
      run = "__json_as_observe_sweep_run";
    rt.statements.push(
      bind(
        SimpleParser.parseTopLevelStatement(
          `@external("env","jsonSweepItem") declare function ${item}():void;`,
        ),
      ),
      bind(
        SimpleParser.parseTopLevelStatement(
          `@external("env","jsonSweepRun") declare function ${run}():void;`,
        ),
      ),
    );
    defer.body.statements.unshift(
      bind(SimpleParser.parseStatement(`${item}();`)),
    );
    const held = flush.body.statements[1];
    if (!held.ifTrue?.statements) throw Error("Unexpected flush body");
    held.ifTrue.statements.unshift(
      bind(SimpleParser.parseStatement(`${run}();`)),
    );
  }
}
