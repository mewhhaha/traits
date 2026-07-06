import {
  type As,
  type Data,
  data,
  type type_data,
  type type_item,
} from "./typeclass.ts";
import {
  Alternative,
  Applicative,
  applicative_lift_method,
  compare_unknown,
  Eq,
  Foldable,
  Functor,
  Monad,
  Ord,
  Show,
  Traversable,
} from "./typeclasses.ts";

export type Maybe<item> =
  | readonly ["just", item]
  | Nothing;

export type Just<item> = readonly ["just", item];
export type Nothing = readonly ["nothing"];

export interface AsMaybe
  extends
    As<AsMaybe>,
    Show<AsMaybe>,
    Eq<AsMaybe>,
    Functor<AsMaybe>,
    Applicative<AsMaybe>,
    Alternative<AsMaybe>,
    Monad<AsMaybe>,
    Foldable<AsMaybe>,
    Traversable<AsMaybe>,
    Ord<AsMaybe> {
  readonly [type_item]: unknown;
  readonly [type_data]: Maybe<this[typeof type_item]>;
}

type MaybeValue<item> = Data<AsMaybe, item>;

export const Maybe: AsMaybe = data<AsMaybe>();
const nothing_value = Maybe(maybe_nothing<never>());

export function just<item>(value: item): MaybeValue<item> {
  return Maybe(maybe_just(value));
}

export function nothing<item = never>(): MaybeValue<item> {
  return nothing_value as MaybeValue<item>;
}

export function is_just<item>(value: Maybe<item>): value is Just<item> {
  const [tag] = value;

  return tag === "just";
}

export function is_nothing<item>(value: Maybe<item>): value is Nothing {
  const [tag] = value;

  return tag === "nothing";
}

export function from_nullable<item>(
  value: item | null | undefined,
): MaybeValue<item> {
  if (value === null) {
    return nothing<item>();
  }

  if (value === undefined) {
    return nothing<item>();
  }

  return Maybe(maybe_just<item>(value));
}

Show.instance(Maybe)({
  show() {
    const [tag, payload] = this.value();

    switch (tag) {
      case "just":
        return "Just(" + Deno.inspect(payload) + ")";
      case "nothing":
        return "Nothing";
    }
  },
});

Eq.instance(Maybe)({
  eq(right) {
    const [left_tag, left_payload] = this.value();
    const [right_tag, right_payload] = right.value();

    switch (left_tag) {
      case "nothing":
        return right_tag === "nothing";
      case "just":
        switch (right_tag) {
          case "nothing":
            return false;
          case "just":
            return Object.is(left_payload, right_payload);
        }
    }
  },
});

Ord.instance(Maybe)({
  compare(right) {
    const [left_tag, left_payload] = this.value();
    const [right_tag, right_payload] = right.value();

    switch (left_tag) {
      case "nothing":
        if (right_tag === "nothing") {
          return "eq";
        }

        return "lt";
      case "just":
        if (right_tag === "nothing") {
          return "gt";
        }

        return compare_unknown(left_payload, right_payload);
    }
  },
});

Functor.instance(Maybe)({
  map(fn) {
    const [tag, payload] = this.value();

    switch (tag) {
      case "nothing":
        return same_context(this);
      case "just":
        return just(fn(payload));
    }
  },
});

Applicative.instance(Maybe)({
  pure(value) {
    return just(value);
  },

  [applicative_lift_method](fn, rest) {
    const [tag, payload] = this.value();

    switch (tag) {
      case "nothing":
        return same_context(this);
      case "just":
        return lift_just(fn, payload, rest);
    }
  },

  ap(value) {
    const [fn_tag, fn] = this.value();

    switch (fn_tag) {
      case "nothing":
        return same_context(this);
      case "just": {
        const [maybe_tag, maybe] = value.value();

        switch (maybe_tag) {
          case "nothing":
            return same_context(value);
          case "just":
            return just(fn(maybe));
        }
      }
    }
  },
});

Alternative.instance(Maybe)({
  empty() {
    return nothing();
  },

  alt(right) {
    const [tag] = this.value();

    switch (tag) {
      case "just":
        return same_context(this);
      case "nothing":
        return right;
    }
  },
});

Monad.instance(Maybe)({
  bind(fn) {
    const [tag, payload] = this.value();

    switch (tag) {
      case "nothing":
        return same_context(this);
      case "just":
        return fn(payload);
    }
  },
});

Foldable.instance(Maybe)({
  fold(initial, fn) {
    const [tag, payload] = this.value();

    switch (tag) {
      case "nothing":
        return initial;
      case "just":
        return fn(initial, payload);
    }
  },
});

Traversable.instance(Maybe)({
  traverse(applicative, fn) {
    const [tag, payload] = this.value();

    switch (tag) {
      case "nothing":
        return Applicative.pure(applicative, nothing());
      case "just":
        return Functor.map(fn(payload), (value) => just(value));
    }
  },
});

function maybe_just<item>(value: item): Just<item> {
  return ["just", value];
}

function maybe_nothing<item = never>(): Maybe<item> {
  return ["nothing"];
}

function lift_just<out>(
  fn: (...values: unknown[]) => out,
  first: unknown,
  rest: readonly MaybeValue<unknown>[],
): MaybeValue<out> {
  switch (rest.length) {
    case 0:
      return just(fn(first));
    case 1: {
      const [tag, payload] = rest[0].value();

      switch (tag) {
        case "nothing":
          return same_context(rest[0]);
        case "just":
          return just(fn(first, payload));
      }
    }
  }

  const values = [first];

  for (const current of rest) {
    const [tag, payload] = current.value();

    switch (tag) {
      case "nothing":
        return same_context(current);
      case "just":
        values.push(payload);
        break;
    }
  }

  return just(fn(...values));
}

function same_context<out>(value: unknown): out {
  return value as out;
}
