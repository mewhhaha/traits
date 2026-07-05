import {
  type As,
  define,
  type Trait,
  type type_item,
  type type_value,
} from "./trait.ts";
import { Arrow, Category, Functor, Parse, Profunctor, Show } from "./traits.ts";

export type Fn<input, item> = (value: input) => item;

export interface AsFn
  extends
    As<AsFn>,
    Show<AsFn>,
    Functor<AsFn>,
    Profunctor<AsFn>,
    Category<AsFn>,
    Arrow<AsFn>,
    Parse<AsFn> {
  readonly [type_item]: unknown;
  readonly [type_value]: Fn<never, this[typeof type_item]>;
}

export type FnValue<input, item> = Trait<AsFn, Fn<input, item>, item>;

export const Fn = define<AsFn>();

export function fn<input, item>(value: Fn<input, item>): FnValue<input, item> {
  return Fn(value) as FnValue<input, item>;
}

export function arr<input, item>(
  value: Fn<input, item>,
): FnValue<input, item> {
  return fn(value);
}

Show.implement(Fn)({
  show() {
    return "Fn(?)";
  },
});

Functor.implement(Fn)({
  map(output) {
    const run = this.value() as (value: unknown) => unknown;

    return Fn((value: unknown) => {
      return output(run(value) as never);
    });
  },
});

Profunctor.implement(Fn)({
  dimap<raw, from, to, next_from, next_to>(
    this: Trait<AsFn, raw, to>,
    input: (value: next_from) => from,
    output: (value: to) => next_to,
  ) {
    const run = this.value() as (value: from) => to;

    return unknown_trait<next_to>(
      Fn((value: next_from) => {
        return output(run(input(value)));
      }),
    );
  },
});

Category.implement(Fn)({
  id<item>(this: AsFn) {
    return unknown_trait<item>(
      Fn((value: item) => {
        return value;
      }),
    );
  },

  compose<after_raw, before_raw, from, middle, to>(
    this: Trait<AsFn, after_raw, to>,
    before: Trait<AsFn, before_raw, middle>,
  ) {
    const after_run = this.value() as (value: middle) => to;
    const before_run = before.value() as (value: from) => middle;

    return unknown_trait<to>(
      Fn((value: from) => {
        return after_run(before_run(value));
      }),
    );
  },
});

Arrow.implement(Fn)({
  arr<from, to>(
    this: AsFn,
    fn: (value: from) => to,
  ) {
    return unknown_trait<to>(Fn(fn as Fn<from, to>));
  },

  first<raw, from, to, extra>(this: Trait<AsFn, raw, to>) {
    const run = this.value() as (value: from) => to;

    return unknown_trait<readonly [to, extra]>(
      Fn((pair: readonly [from, extra]) => {
        return [run(pair[0]), pair[1]] as const;
      }),
    );
  },

  second<raw, from, to, extra>(this: Trait<AsFn, raw, to>) {
    const run = this.value() as (value: from) => to;

    return unknown_trait<readonly [extra, to]>(
      Fn((pair: readonly [extra, from]) => {
        return [pair[0], run(pair[1])] as const;
      }),
    );
  },
});

Parse.implement(Fn)({
  parse<raw, item>(
    this: Trait<AsFn, raw, item>,
    input: string,
  ) {
    const run = this.value() as (value: string) => item;

    return run(input);
  },
});

function unknown_trait<item>(
  value: unknown,
): Trait<AsFn, unknown, item> {
  return value as Trait<AsFn, unknown, item>;
}
