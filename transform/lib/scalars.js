export const UNSIGNED_INTEGER_TYPES = ["u8", "u16", "u32", "u64", "usize"];
export const SIGNED_INTEGER_TYPES = ["i8", "i16", "i32", "i64", "isize"];
export const FLOAT_TYPES = ["f32", "f64", "number"];
export const INTEGER_TYPES = [
    ...UNSIGNED_INTEGER_TYPES,
    ...SIGNED_INTEGER_TYPES,
];
export const NUMERIC_TYPES = [...INTEGER_TYPES, ...FLOAT_TYPES];
export function isScalarType(type) {
    return NUMERIC_TYPES.includes(type) || type === "bool" || type === "boolean";
}
