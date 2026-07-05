import {
  type As,
  define,
  type Trait,
  type type_item,
  type type_value,
} from "./trait.ts";
import {
  Bifunctor,
  compare_unknown,
  Eq,
  Foldable,
  Functor,
  Ord,
  Show,
  Traversable,
} from "./traits.ts";

export type Tuple<left, right> = readonly [left, right];

export interface AsTuple
  extends
    As<AsTuple>,
    Show<AsTuple>,
    Eq<AsTuple>,
    Ord<AsTuple>,
    Bifunctor<AsTuple>,
    Functor<AsTuple>,
    Foldable<AsTuple>,
    Traversable<AsTuple> {
  readonly [type_item]: unknown;
  readonly [type_value]: Tuple<unknown, this[typeof type_item]>;
}

export type TupleValue<left, right> = Trait<
  AsTuple,
  Tuple<left, right>,
  right
>;

type TupleConstructor =
  & AsTuple
  & {
    <left, right>(value: Tuple<left, right>): TupleValue<left, right>;
  };

export const Tuple = define<AsTuple>() as TupleConstructor;

export function tuple<left, right>(
  left: left,
  right: right,
): TupleValue<left, right> {
  return Tuple([left, right] as const) as TupleValue<left, right>;
}

export function fst<left, right>(value: TupleValue<left, right>): left {
  return value.value()[0];
}

export function snd<left, right>(value: TupleValue<left, right>): right {
  return value.value()[1];
}

export function swap<left, right>(
  value: TupleValue<left, right>,
): TupleValue<right, left> {
  const [left, right] = value.value();

  return tuple(right, left);
}

Show.implement(Tuple)({
  show() {
    const [left, right] = this.value();

    return "Tuple(" + Deno.inspect(left) + ", " + Deno.inspect(right) + ")";
  },
});

Eq.implement(Tuple)({
  eq(right) {
    const [left_first, left_second] = this.value();
    const [right_first, right_second] = right.value();

    if (!Object.is(left_first, right_first)) {
      return false;
    }

    return Object.is(left_second, right_second);
  },
});

Ord.implement(Tuple)({
  compare(right) {
    const [left_first, left_second] = this.value();
    const [right_first, right_second] = right.value();
    const first_order = compare_unknown(left_first, right_first);

    switch (first_order) {
      case "eq":
        return compare_unknown(left_second, right_second);
      case "lt":
      case "gt":
        return first_order;
    }
  },
});

Bifunctor.implement(Tuple)({
  bimap<raw, left, right, next_left, next_right>(
    this: Trait<AsTuple, raw, right>,
    map_left: (value: left) => next_left,
    map_right: (value: right) => next_right,
  ) {
    const [left, right] = this.value() as Tuple<left, right>;

    return unknown_trait<next_right>(tuple(map_left(left), map_right(right)));
  },
});

Functor.implement(Tuple)({
  map(fn) {
    const [left, right] = this.value();

    return tuple(left, fn(right));
  },
});

Foldable.implement(Tuple)({
  fold(initial, fn) {
    const [_left, right] = this.value();

    return fn(initial, right);
  },
});

Traversable.implement(Tuple)({
  traverse(_applicative, fn) {
    const [left, right] = this.value();

    return Functor.map(fn(right), (value) => tuple(left, value));
  },
});

function unknown_trait<item>(
  value: unknown,
): Trait<AsTuple, unknown, item> {
  return value as Trait<AsTuple, unknown, item>;
}
