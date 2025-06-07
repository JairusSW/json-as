import { TypeAlias } from "./linkers/alias.js";
export var PropertyFlags;
(function (PropertyFlags) {
    PropertyFlags[PropertyFlags["OmitNull"] = 0] = "OmitNull";
    PropertyFlags[PropertyFlags["OmitIf"] = 1] = "OmitIf";
    PropertyFlags[PropertyFlags["Raw"] = 2] = "Raw";
    PropertyFlags[PropertyFlags["Custom"] = 3] = "Custom";
})(PropertyFlags || (PropertyFlags = {}));
export class Property {
    name = "";
    alias = null;
    type = "";
    value = null;
    flags = new Map();
    node;
    byteSize = 0;
    generic = false;
    _custom = false;
    parent;
    set custom(value) {
        this._custom = value;
    }
    get custom() {
        if (this._custom)
            return true;
        if (this.parent.node.isGeneric && this.parent.node.typeParameters.some((p) => p.name.text == this.type)) {
            this.generic = true;
            this._custom = true;
            return true;
        }
        for (const dep of this.parent.deps) {
            if (this.name == dep.name) {
                this._custom = true;
                return true;
            }
        }
        return false;
    }
}
export class Schema {
    static = true;
    name = "";
    members = [];
    parent = null;
    node;
    needsLink = null;
    byteSize = 0;
    deps = [];
    _custom = false;
    set custom(value) {
        this._custom = value;
    }
    get custom() {
        if (this._custom)
            return true;
        if (this.parent)
            return this.parent.custom;
    }
}
export class Src {
    internalPath;
    schemas;
    aliases;
    imports;
    exports;
    constructor(source) {
        this.internalPath = source.internalPath;
        this.aliases = TypeAlias.getAliases(source);
    }
}
//# sourceMappingURL=types.js.map