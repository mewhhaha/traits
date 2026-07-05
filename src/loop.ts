const loop_done = Symbol("loop.done");
const loop_rec = Symbol("loop.rec");

export type LoopDone<out> = readonly [typeof loop_done, out];
export type LoopRec<state> = readonly [typeof loop_rec, state];
export type LoopStep<state, out> = LoopDone<out> | LoopRec<state>;

export function loop<state, out>(
  initial: state,
  step: (state: state) => LoopStep<state, out>,
): out {
  let state = initial;

  while (true) {
    const [tag, value] = step(state);

    switch (tag) {
      case loop_done:
        return value;
      case loop_rec:
        state = value;
        break;
    }
  }
}

export function done<out>(value: out): LoopDone<out> {
  return [loop_done, value] as const;
}

export function rec<state>(state: state): LoopRec<state> {
  return [loop_rec, state] as const;
}
