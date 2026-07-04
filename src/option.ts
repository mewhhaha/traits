import { type As, define, type Value } from "./trait.ts";
import {
  Alternative,
  Applicative,
  Equal,
  Foldable,
  Format,
  Functor,
  Monad,
  Traversable,
} from "./traits.ts";

export type Option<item> =
  | readonly ["some", item]
  | None;

export type Some<item> = readonly ["some", item];
export type None = readonly ["none"];

export const option_kind = Symbol("Option");

declare module "./trait.ts" {
  interface TraitTypes<dictionary, item> {
    [option_kind]: Option<item>;
  }
}

export interface AsOption extends As<typeof option_kind> {}

type OptionValue<item> = Value<AsOption, item>;

export const Option = define<AsOption>(
  option_kind,
);
const none_value = Option(option_none<never>());

export function some<item>(value: item) {
  return Option(option_some(value));
}

export function none<item = never>(): OptionValue<item> {
  return none_value as OptionValue<item>;
}

export function is_some<item>(value: Option<item>): value is Some<item> {
  const [tag] = value;

  return tag === "some";
}

export function is_none<item>(value: Option<item>): value is None {
  const [tag] = value;

  return tag === "none";
}

export function from_nullable<item>(
  value: item | null | undefined,
) {
  if (value === null) {
    return none<item>();
  }

  if (value === undefined) {
    return none<item>();
  }

  return Option(option_some<item>(value));
}

Format.implement(Option)({
  fmt() {
    const [tag, payload] = this.value();

    switch (tag) {
      case "some":
        return "Some(" + Deno.inspect(payload) + ")";
      case "none":
        return "None";
    }
  },
});

export interface AsOption extends Format<AsOption> {}

Equal.implement(Option)({
  eq(right) {
    const [left_tag, left_payload] = this.value();
    const [right_tag, right_payload] = right.value();

    switch (left_tag) {
      case "none":
        return right_tag === "none";
      case "some":
        switch (right_tag) {
          case "none":
            return false;
          case "some":
            return Object.is(left_payload, right_payload);
        }
    }
  },
});

export interface AsOption extends Equal<AsOption> {}

Functor.implement(Option)({
  map(fn) {
    const [tag, payload] = this.value();

    switch (tag) {
      case "none":
        return same_context(this);
      case "some":
        return some(fn(payload));
    }
  },
});

export interface AsOption extends Functor<AsOption> {}

Applicative.implement(Option)({
  pure(value) {
    return some(value);
  },

  ap(value) {
    const [fn_tag, fn] = this.value();

    switch (fn_tag) {
      case "none":
        return same_context(this);
      case "some": {
        const [option_tag, option] = value.value();

        switch (option_tag) {
          case "none":
            return same_context(value);
          case "some":
            return some(fn(option));
        }
      }
    }
  },
});

export interface AsOption extends Applicative<AsOption> {}

Alternative.implement(Option)({
  empty() {
    return none();
  },

  alt(right) {
    const option = this.value();
    const [tag] = option;

    switch (tag) {
      case "some":
        return Option(option);
      case "none":
        return right;
    }
  },
});

export interface AsOption extends Alternative<AsOption> {}

Monad.implement(Option)({
  bind(fn) {
    const [tag, payload] = this.value();

    switch (tag) {
      case "none":
        return same_context(this);
      case "some":
        return fn(payload);
    }
  },
});

export interface AsOption extends Monad<AsOption> {}

Foldable.implement(Option)({
  fold(initial, fn) {
    const [tag, payload] = this.value();

    switch (tag) {
      case "none":
        return initial;
      case "some":
        return fn(initial, payload);
    }
  },
});

export interface AsOption extends Foldable<AsOption> {}

Traversable.implement(Option)({
  traverse(applicative, fn) {
    const [tag, payload] = this.value();

    switch (tag) {
      case "none":
        return Applicative.pure(applicative, none());
      case "some":
        return Functor.map(fn(payload), (value) => some(value));
    }
  },
});

export interface AsOption extends Traversable<AsOption> {}

function option_some<item>(value: item): Some<item> {
  return ["some", value];
}

function option_none<item = never>(): Option<item> {
  return ["none"];
}

function same_context<out>(value: unknown): out {
  return value as out;
}
