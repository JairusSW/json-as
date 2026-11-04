enum State {
  Off,
  On,
}
type Intermediate = State;
export type PublicState = Intermediate;
export function make(): PublicState {
  return State.Off;
}
