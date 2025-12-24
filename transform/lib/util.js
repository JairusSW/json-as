import { Parser, Tokenizer, Source } from "assemblyscript/dist/assemblyscript.js";
import { ASTBuilder } from "./builder.js";
import * as path from "path";
export class SimpleParser {
    static get parser() {
        return new Parser();
    }
    static getTokenizer(s, file = "index.ts") {
        return new Tokenizer(new Source(0, file, s));
    }
    static parseExpression(s) {
        const res = this.parser.parseExpression(this.getTokenizer(s));
        if (res == null) {
            throw new Error("Failed to parse the expression: '" + s + "'");
        }
        return res;
    }
    static parseStatement(s, topLevel = false) {
        const res = this.parser.parseStatement(this.getTokenizer(s), topLevel);
        if (res == null) {
            throw new Error("Failed to parse the statement: '" + s + "'");
        }
        return res;
    }
    static parseTopLevelStatement(s, namespace) {
        const res = this.parser.parseTopLevelStatement(this.getTokenizer(s), namespace);
        if (res == null) {
            throw new Error("Failed to parse the top level statement: '" + s + "'");
        }
        return res;
    }
    static parseClassMember(s, _class) {
        let res = this.parser.parseClassMember(this.getTokenizer(s, _class.range.source.normalizedPath), _class);
        if (res == null) {
            throw new Error("Failed to parse the class member: '" + s + "'");
        }
        return res;
    }
}
let isStdlibRegex = /\~lib\/(?:array|arraybuffer|atomics|builtins|crypto|console|compat|dataview|date|diagnostics|error|function|iterator|map|math|number|object|process|reference|regexp|set|staticarray|string|symbol|table|typedarray|vector|rt\/?|bindings\/|shared\/typeinfo)|util\/|uri|polyfills|memory/;
export function isStdlib(s) {
    let source = s instanceof Source ? s : s.range.source;
    return isStdlibRegex.test(source.internalPath);
}
export function toString(node) {
    return ASTBuilder.build(node);
}
export function replaceRef(node, replacement, ref) {
    if (!node || !ref)
        return;
    const nodeExpr = stripExpr(node);
    if (Array.isArray(ref)) {
        for (let i = 0; i < ref.length; i++) {
            if (stripExpr(ref[i]) === nodeExpr) {
                if (Array.isArray(replacement))
                    ref.splice(i, 1, ...replacement);
                else
                    ref.splice(i, 1, replacement);
                return;
            }
        }
    }
    else if (typeof ref === "object") {
        for (const key of Object.keys(ref)) {
            const current = ref[key];
            if (Array.isArray(current)) {
                for (let i = 0; i < current.length; i++) {
                    if (stripExpr(current[i]) === nodeExpr) {
                        if (Array.isArray(replacement))
                            current.splice(i, 1, ...replacement);
                        else
                            current.splice(i, 1, replacement);
                        return;
                    }
                }
            }
            else if (stripExpr(current) === nodeExpr) {
                ref[key] = replacement;
                return;
            }
        }
    }
}
export function cloneNode(input, seen = new WeakMap(), path = "") {
    if (input === null || typeof input !== "object")
        return input;
    if (Array.isArray(input)) {
        return input.map((item, index) => cloneNode(item, seen, `${path}[${index}]`));
    }
    if (seen.has(input))
        return seen.get(input);
    const prototype = Object.getPrototypeOf(input);
    const clone = Array.isArray(input) ? [] : Object.create(prototype);
    seen.set(input, clone);
    for (const key of Reflect.ownKeys(input)) {
        const value = input[key];
        const newPath = path ? `${path}.${String(key)}` : String(key);
        if (newPath.endsWith(".source")) {
            clone[key] = value;
        }
        else if (value && typeof value === "object") {
            clone[key] = cloneNode(value, seen, newPath);
        }
        else {
            clone[key] = value;
        }
    }
    return clone;
}
export function stripExpr(node) {
    if (!node)
        return node;
    if (node.kind == 38)
        return node["expression"];
    return node;
}
export function removeExtension(filePath) {
    const parsed = path.parse(filePath);
    return path.join(parsed.dir, parsed.name);
}
//# sourceMappingURL=util.js.map