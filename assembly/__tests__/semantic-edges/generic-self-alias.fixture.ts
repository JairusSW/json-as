import { Token as PublicToken } from "./generic-self.fixture";
type Identity<U> = U;
export type Self<T> = Identity<PublicToken<T>>;
