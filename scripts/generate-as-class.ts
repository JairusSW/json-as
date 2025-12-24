// gen-obj-properties.ts
import fs from "fs";
import path from "path";

/**
 * Generates AssemblyScript class properties to reach a target byte size.
 * Each i32 property is 4 bytes.
 *
 * @param targetBytes Total desired size in bytes
 * @param prefix Property name prefix
 */
function generateProperties(targetBytes: number, prefix = "key"): string {
  const bytesPerProp = 4; // i32
  const numProps = Math.ceil(targetBytes / bytesPerProp);
  let result = "";

  for (let i = 0; i < numProps; i++) {
    result += `${prefix}${i}: i32 = ${i}; `;
    if ((i + 1) % 10 === 0) result += "\n  ";
  }

  return result.trim();
}

/**
 * Generate AssemblyScript class source
 */
function generateClass(name: string, targetBytes: number) {
  const props = generateProperties(targetBytes);
  return `@json
class ${name} {
  ${props}
}
`;
}

/* =================================
 * CONFIGURATION
 * ================================= */
const classes = [
  { name: "ObjSmall", sizeKB: 100 },
  { name: "ObjMedium", sizeKB: 500 },
  { name: "ObjLarge", sizeKB: 1024 },
];

for (const cls of classes) {
  const source = generateClass(cls.name, cls.sizeKB * 1024);
  console.log(`// ===== ${cls.name} =====`);
  console.log(source);
}
