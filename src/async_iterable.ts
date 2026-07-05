import {
  type As,
  define,
  type type_item,
  type type_value,
  type Value,
} from "./trait.ts";
import {
  Alternative,
  Applicative,
  Format,
  Functor,
  Monad,
  Monoid,
  Semigroup,
} from "./traits.ts";

export type AsyncIterableT<item> = () => AsyncIterable<item>;

export interface AsAsyncIterable
  extends
    As<AsAsyncIterable>,
    Format<AsAsyncIterable>,
    Functor<AsAsyncIterable>,
    Applicative<AsAsyncIterable>,
    Semigroup<AsAsyncIterable>,
    Monoid<AsAsyncIterable>,
    Alternative<AsAsyncIterable>,
    Monad<AsAsyncIterable> {
  readonly [type_item]: unknown;
  readonly [type_value]: AsyncIterableT<this[typeof type_item]>;
}

type AsyncIterableValue<item> = Value<AsAsyncIterable, item>;

export const AsyncIterableT = define<AsAsyncIterable>();

export function from_factory<item>(
  factory: () => AsyncIterable<item>,
): AsyncIterableValue<item> {
  return AsyncIterableT(factory);
}

export function from_async_iterable<item>(
  iterable: AsyncIterable<item>,
): AsyncIterableValue<item> {
  return AsyncIterableT(() => iterable);
}

export async function to_array<item>(
  iterable: AsyncIterableValue<item>,
): Promise<item[]> {
  const items: item[] = [];

  for await (const item of iterable.value()()) {
    items.push(item);
  }

  return items;
}

Format.implement(AsyncIterableT)({
  fmt() {
    return "AsyncIterable(?)";
  },
});

Functor.implement(AsyncIterableT)({
  map(fn) {
    const source = this.value();

    return AsyncIterableT(async function* () {
      for await (const item of source()) {
        yield fn(item);
      }
    });
  },
});

Applicative.implement(AsyncIterableT)({
  pure(value) {
    return AsyncIterableT(async function* () {
      yield value;
    });
  },

  ap(values) {
    const fns = this.value();
    const items = values.value();

    return AsyncIterableT(async function* () {
      for await (const fn of fns()) {
        for await (const item of items()) {
          yield fn(item);
        }
      }
    });
  },
});

Semigroup.implement(AsyncIterableT)({
  concat(right) {
    const left = this.value();
    const right_value = right.value();

    return AsyncIterableT(async function* () {
      yield* left();
      yield* right_value();
    });
  },
});

Monoid.implement(AsyncIterableT)({
  empty() {
    return AsyncIterableT(async function* () {});
  },
});

Alternative.implement(AsyncIterableT)({
  empty() {
    return AsyncIterableT(async function* () {});
  },

  alt(right) {
    const left = this.value();
    const right_value = right.value();

    return AsyncIterableT(async function* () {
      yield* left();
      yield* right_value();
    });
  },
});

Monad.implement(AsyncIterableT)({
  bind(fn) {
    const source = this.value();

    return AsyncIterableT(async function* () {
      for await (const item of source()) {
        yield* fn(item).value()();
      }
    });
  },
});
