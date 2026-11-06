import { MethodDeclaration, Source } from "assemblyscript/dist/assemblyscript.js";
export declare function parseDiagnosticsFlag(value: string | undefined): boolean;
export declare function collectOriginalMethods(sources: Source[]): WeakSet<MethodDeclaration>;
export declare function diagnosticsRuntimeRoot(sources: Source[]): string | undefined;
export declare function lowerDiagnostics(source: Source, originalMethods: WeakSet<MethodDeclaration>, runtimeRoot: string | undefined): void;
