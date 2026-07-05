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
  compare_unknown,
  Eq,
  Foldable,
  Functor,
  Monad,
  Ord,
  Show,
  Traversable,
} from "./traits.ts";

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
  readonly [type_value]: Maybe<this[typeof type_item]>;
}

type MaybeValue<item> = Value<AsMaybe, item>;

export const Maybe = define<AsMaybe>();
const nothing_value = Maybe(maybe_nothing<never>());

export function just<item>(value: item) {
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
) {
  if (value === null) {
    return nothing<item>();
  }

  if (value === undefined) {
    return nothing<item>();
  }

  return Maybe(maybe_just<item>(value));
}

Show.implement(Maybe)({
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

Eq.implement(Maybe)({
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

Ord.implement(Maybe)({
  compare(right) {
    const [left_tag, left_payload] = this.value();
    const [right_tag, right_payload] = right.value();

    switch (left_tag) {
      case "nothing":
        switch (right_tag) {
          case "nothing":
            return "eq";
          case "just":
            return "lt";
        }
        break;
      case "just":
        switch (right_tag) {
          case "nothing":
            return "gt";
          case "just":
            return compare_unknown(left_payload, right_payload);
        }
        break;
    }

    return "eq";
  },
});

Functor.implement(Maybe)({
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

Applicative.implement(Maybe)({
  pure(value) {
    return just(value);
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

Alternative.implement(Maybe)({
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

Monad.implement(Maybe)({
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

Foldable.implement(Maybe)({
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

Traversable.implement(Maybe)({
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

function same_context<out>(value: unknown): out {
  return value as out;
}
