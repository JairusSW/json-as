// Characters
// @ts-ignore = Decorator is valid here
@inline export const COMMA = 44;
// @ts-ignore = Decorator is valid here
@inline export const QUOTE = 34;
// @ts-ignore = Decorator is valid here
@inline export const BACK_SLASH = 92;
// @ts-ignore: Decorator is valid here
@inline export const FWD_SLASH = 47;
// @ts-ignore: Decorator is valid here
@inline export const BRACE_LEFT = 123;
// @ts-ignore: Decorator is valid here
@inline export const BRACE_RIGHT = 125;
// @ts-ignore: Decorator is valid here
@inline export const BRACKET_LEFT = 91;
// @ts-ignore: Decorator is valid here
@inline export const BRACKET_RIGHT = 93;
// @ts-ignore: Decorator is valid here
@inline export const COLON = 58;
// @ts-ignore: Decorator is valid here
@inline export const CHAR_T = 116;
// @ts-ignore: Decorator is valid here
@inline export const CHAR_R = 114;
// @ts-ignore: Decorator is valid here
@inline export const CHAR_U = 117;
// @ts-ignore: Decorator is valid here
@inline export const CHAR_E = 101;
// @ts-ignore: Decorator is valid here
@inline export const CHAR_F = 102;
// @ts-ignore: Decorator is valid here
@inline export const CHAR_A = 97;
// @ts-ignore: Decorator is valid here
@inline export const CHAR_L = 108;
// @ts-ignore: Decorator is valid here
@inline export const CHAR_S = 115;
// @ts-ignore = Decorator is valid here
@inline export const CHAR_N = 110;
// @ts-ignore = Decorator is valid here
@inline export const CHAR_B = 98;
// Strings
// @ts-ignore: Decorator is valid here
@inline export const TRUE_WORD = "true";
// @ts-ignore: Decorator is valid here
@inline export const FALSE_WORD = "false";
// @ts-ignore: Decorator is valid here
@inline export const NULL_WORD = "null";
// @ts-ignore: Decorator is valid here
@inline export const BRACE_LEFT_WORD = "{";
// @ts-ignore: Decorator is valid here
@inline export const BRACKET_LEFT_WORD = "[";
// @ts-ignore: Decorator is valid here
@inline export const EMPTY_BRACKET_WORD = "[]";
// @ts-ignore: Decorator is valid here
@inline export const COLON_WORD = ":";
// @ts-ignore: Decorator is valid here
@inline export const COMMA_WORD = ",";
// @ts-ignore: Decorator is valid here
@inline export const BRACE_RIGHT_WORD = "}";
// @ts-ignore: Decorator is valid here
@inline export const BRACKET_RIGHT_WORD = "]";
// @ts-ignore: Decorator is valid here
@inline export const QUOTE_WORD = '"';
// @ts-ignore: Decorator is valid here
@inline export const EMPTY_QUOTE_WORD = '""';

// Escape Codes
// @ts-ignore: Decorator is valid here
@inline export const BACKSPACE = 8; // \b
// @ts-ignore: Decorator is valid here
@inline export const TAB = 9; // \t
// @ts-ignore: Decorator is valid here
@inline export const NEW_LINE = 10; // \n
// @ts-ignore: Decorator is valid here
@inline export const FORM_FEED = 12; // \f
// @ts-ignore: Decorator is valid here
@inline export const CARRIAGE_RETURN = 13; // \r

// Pre-encoded u64 constants for common JSON literals
// These represent the UTF-16 encoded bytes stored as u64 for fast comparison/storage
// @ts-ignore: Decorator is valid here
@inline export const NULL_WORD_U64: u64 = 30399761348886638; // "null" as u64 (n=110, u=117, l=108, l=108)
// @ts-ignore: Decorator is valid here
@inline export const TRUE_WORD_U64: u64 = 28429475166421108; // "true" as u64 (t=116, r=114, u=117, e=101)
// @ts-ignore: Decorator is valid here
@inline export const FALSE_WORD_U64: u64 = 32370086184550502; // "fals" as u64 (f=102, a=97, l=108, s=115) - first 4 chars of "false"
