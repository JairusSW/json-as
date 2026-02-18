import { Parser } from "assemblyscript/dist/assemblyscript.js";
import { Property, Src } from "../types.js";
export declare function sortMembers(members: Property[]): Property[];
export declare function toU16(data: string, offset?: number): string;
export declare function toU32(data: string, offset?: number): string;
export declare function toU48(data: string, offset?: number): string;
export declare function toU64(data: string, offset?: number): string;
export declare function toMemCDecl(n: number, indent: string): string;
export declare function toMemCCheck(data: string): string;
export declare function strToNum(data: string, simd?: boolean, offset?: number): string[][];
export declare function sizeof(type: string): number;
export declare function isPrimitive(type: string): boolean;
export declare function isBoolean(type: string): boolean;
export declare function stripNull(type: string): string;
export declare function isString(type: string): boolean;
export declare function isArray(type: string): boolean;
export declare function isEnum(type: string, source: Src, parser: Parser): boolean;
export declare function getComparison(data: string): string;
//# sourceMappingURL=common.d.ts.map