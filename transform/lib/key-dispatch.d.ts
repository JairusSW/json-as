export type KeyDispatch<T> = {
    members: T[];
} | {
    offset: number;
    pivot: number;
    left: KeyDispatch<T>;
    right: KeyDispatch<T>;
};
export declare function keyDispatch<T>(members: T[], key: (member: T) => string): KeyDispatch<T>;
