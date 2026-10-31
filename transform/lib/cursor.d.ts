import { type Property } from "./types.js";
export declare function generateCursorParser(members: Property[], compare: (key: string, ptr: string, operator: string) => string[]): string;
