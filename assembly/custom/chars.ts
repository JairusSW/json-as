// Characters
export const COMMA = 44;
export const QUOTE = 34;
export const BACK_SLASH = 92;
export const FWD_SLASH = 47;
export const BRACE_LEFT = 123;
export const BRACE_RIGHT = 125;
export const BRACKET_LEFT = 91;
export const BRACKET_RIGHT = 93;
export const COLON = 58;
export const CHAR_T = 116;
export const CHAR_R = 114;
export const CHAR_U = 117;
export const CHAR_E = 101;
export const CHAR_F = 102;
export const CHAR_A = 97;
export const CHAR_L = 108;
export const CHAR_S = 115;
export const CHAR_N = 110;
export const CHAR_B = 98;
// Strings
export const TRUE_WORD = "true";
export const FALSE_WORD = "false";
export const NULL_WORD = "null";
export const BRACE_LEFT_WORD = "{";
export const BRACKET_LEFT_WORD = "[";
export const EMPTY_BRACKET_WORD = "[]";
export const COLON_WORD = ":";
export const COMMA_WORD = ",";
export const BRACE_RIGHT_WORD = "}";
export const BRACKET_RIGHT_WORD = "]";
export const QUOTE_WORD = '"';
export const EMPTY_QUOTE_WORD = '""';

// Escape Codes
export const BACKSPACE = 8; // \b
export const TAB = 9; // \t
export const NEW_LINE = 10; // \n
export const FORM_FEED = 12; // \f
export const CARRIAGE_RETURN = 13; // \r

// Pre-encoded u64 constants for common JSON literals
// These represent the UTF-16 encoded bytes stored as u64 for fast comparison/storage
export const NULL_WORD_U64: u64 = 30399761348886638; // "null" as u64 (n=110, u=117, l=108, l=108)
export const TRUE_WORD_U64: u64 = 28429475166421108; // "true" as u64 (t=116, r=114, u=117, e=101)
export const FALSE_WORD_U64: u64 = 32370086184550502; // "fals" as u64 (f=102, a=97, l=108, s=115) - first 4 chars of "false"
