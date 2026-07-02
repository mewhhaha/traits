import {
  as_trait,
  type Dictionary,
  item_type,
  kind,
  type Value,
  value_type,
} from "./trait.ts";
import {
  Alternative,
  Applicative,
  Equal,
  Foldable,
  Format,
  Functor,
  Monad,
  Monoid,
  Semigroup,
  Traversable,
} from "./traits.ts";

export type ArrayT<item> = readonly item[];

export const array_kind: unique symbol = Symbol("ArrayT");

export interface ArrayDictionary extends Dictionary<typeof array_kind> {
  <item>(items: ArrayT<item>): ArrayValue<item>;
  readonly [value_type]: ArrayT<this[typeof item_type]>;
}

type ArrayValue<item> = Value<ArrayDictionary, item>;

export const ArrayT: ArrayDictionary = function <item>(
  items: ArrayT<item>,
) {
  return as_trait(ArrayT, items);
} as ArrayDictionary;

ArrayT[kind] = array_kind;

export function from_array<item>(items: readonly item[]): ArrayValue<item> {
  return ArrayT([...items]);
}

export function to_array<item>(array: ArrayValue<item>): item[] {
  return [...array.value()];
}

Format.implement(ArrayT)({
  fmt(value) {
    const array = value.value();
    return Deno.inspect(array);
  },
});

export interface ArrayDictionary extends Format<typeof ArrayT> {}

Equal.implement(ArrayT)({
  eq(left_value, right) {
    const left = left_value.value();
    const right_value = right.value();

    if (left.length !== right_value.length) {
      return false;
    }

    for (let index = 0; index < left.length; index += 1) {
      if (!Object.is(left[index], right_value[index])) {
        return false;
      }
    }

    return true;
  },
});

export interface ArrayDictionary extends Equal<typeof ArrayT> {}

Functor.implement(ArrayT)({
  map(value, fn) {
    const array = value.value();
    return ArrayT(array.map(fn));
  },
});

export interface ArrayDictionary extends Functor<typeof ArrayT> {}

Applicative.implement(ArrayT)({
  pure(_array, value) {
    return ArrayT([value]);
  },

  ap(functions, values) {
    const fns = functions.value();
    const items = values.value();

    return ArrayT(fns.flatMap((fn) => items.map(fn)));
  },
});

export interface ArrayDictionary extends Applicative<typeof ArrayT> {}

Semigroup.implement(ArrayT)({
  concat(left_value, right) {
    const left = left_value.value();
    return ArrayT([...left, ...right.value()]);
  },
});

export interface ArrayDictionary extends Semigroup<typeof ArrayT> {}

Monoid.implement(ArrayT)({
  empty(_array) {
    return ArrayT([]);
  },
});

export interface ArrayDictionary extends Monoid<typeof ArrayT> {}

Alternative.implement(ArrayT)({
  empty(_array) {
    return ArrayT([]);
  },

  alt(left_value, right) {
    const left = left_value.value();
    return ArrayT([...left, ...right.value()]);
  },
});

export interface ArrayDictionary extends Alternative<typeof ArrayT> {}

Monad.implement(ArrayT)({
  bind(value, fn) {
    const array = value.value();
    return ArrayT(array.flatMap((item) => fn(item).value()));
  },
});

export interface ArrayDictionary extends Monad<typeof ArrayT> {}

Foldable.implement(ArrayT)({
  fold(value, initial, fn) {
    const array = value.value();
    let state = initial;

    for (const item of array) {
      state = fn(state, item);
    }

    return state;
  },
});

export interface ArrayDictionary extends Foldable<typeof ArrayT> {}

Traversable.implement(ArrayT)({
  traverse(value, applicative, fn) {
    const array = value.value();

    if (array.length === 0) {
      return Applicative.pure(applicative, ArrayT([]));
    }

    let index = array.length - 1;
    let out = Functor.map(fn(array[index]), array_single);

    for (index -= 1; index >= 0; index -= 1) {
      out = Applicative.ap(Functor.map(fn(array[index]), array_prepend), out);
    }

    return out;
  },
});

export interface ArrayDictionary extends Traversable<typeof ArrayT> {}

function array_single<item>(item: item): ArrayValue<item> {
  return ArrayT([item]);
}

function array_prepend<item>(head: item) {
  return (tail: ArrayValue<item>) => ArrayT([head, ...tail.value()]);
}
