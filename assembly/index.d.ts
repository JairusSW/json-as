/**
 * Class decorator that enables the class to be recognized as JSON.
 */
// @ts-ignore: type
declare function json(..._): void;

/**
 * Class decorator that enables the class to be recognized as JSON.
 */
// @ts-ignore: type
declare function serializable(..._): void;

/**
 * Property decorator that provides an alias name for JSON serialization.
 */
declare function alias(newName: string): Function;

/**
 * Property decorator that allows omits a field, making it be ignored.
 */
// @ts-ignore: type
declare function omit(..._): void;

/**
 * Property decorator that allows a field to be omitted when equal to an Expression.
 */
declare function omitif(condition: string | ((value: any) => boolean)): Function;

/**
 * Property decorator that allows a field to be omitted when a property is null.
 */
// @ts-ignore: type
declare function omitnull(..._): Function;

/**
 * Method decorator that denotes a function to handle that schema's serialization.
 */
// @ts-ignore: type
declare function serializer(..._): any;

/**
 * Method decorator that denotes a function to handle that schema's deserialization.
 */
// @ts-ignore: type
declare function deserializer(..._): any;
