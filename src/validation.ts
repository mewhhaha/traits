import { type As, define, type Value } from "./trait.ts";
import {
  Applicative,
  Equal,
  Foldable,
  Format,
  Functor,
  Traversable,
} from "./traits.ts";

export type Validation<item> =
  | readonly ["valid", item]
  | readonly ["invalid", readonly string[]];

type Valid<item> = readonly ["valid", item];

export const validation_kind = Symbol("Validation");

declare module "./trait.ts" {
  interface TraitTypes<dictionary, item> {
    [validation_kind]: Validation<item>;
  }
}

export interface AsValidation extends As<typeof validation_kind> {}

type ValidationValue<item> = Value<AsValidation, item>;

export const Validation = define<AsValidation>(
  validation_kind,
);

export function valid<item>(value: item) {
  return Validation(validation_valid(value));
}

export function invalid<item = never>(
  first: string,
  ...rest: string[]
): ValidationValue<item> {
  return Validation(validation_invalid([first, ...rest]));
}

Format.implement(Validation)({
  fmt() {
    const validation = this.value();

    if (validation[0] === "invalid") {
      return "Invalid(" + Deno.inspect(validation[1]) + ")";
    }

    return "Valid(" + Deno.inspect(validation[1]) + ")";
  },
});

export interface AsValidation extends Format<AsValidation> {}

Equal.implement(Validation)({
  eq(right) {
    const left = this.value();
    const right_value = right.value();

    if (left[0] === "valid" && right_value[0] === "valid") {
      return Object.is(left[1], right_value[1]);
    }

    if (left[0] === "invalid" && right_value[0] === "invalid") {
      if (left[1].length !== right_value[1].length) {
        return false;
      }

      return left[1].every((error, index) => {
        return Object.is(error, right_value[1][index]);
      });
    }

    return false;
  },
});

export interface AsValidation extends Equal<AsValidation> {}

Functor.implement(Validation)({
  map(fn) {
    const validation = this.value();

    if (validation[0] === "invalid") {
      return same_context(this);
    }

    return valid(fn(validation[1]));
  },
});

export interface AsValidation extends Functor<AsValidation> {}

Applicative.implement(Validation)({
  pure(value) {
    return valid(value);
  },

  ap(value) {
    const fn = this.value();
    const validation = value.value();

    if (fn[0] === "invalid" && validation[0] === "invalid") {
      return invalid_from_errors([...fn[1], ...validation[1]]);
    }

    if (fn[0] === "invalid") {
      return invalid_from_errors(fn[1]);
    }

    if (validation[0] === "invalid") {
      return invalid_from_errors(validation[1]);
    }

    return valid(fn[1](validation[1]));
  },
});

export interface AsValidation extends Applicative<AsValidation> {}

Foldable.implement(Validation)({
  fold(initial, fn) {
    const validation = this.value();

    if (validation[0] === "invalid") {
      return initial;
    }

    return fn(initial, validation[1]);
  },
});

export interface AsValidation extends Foldable<AsValidation> {}

Traversable.implement(Validation)({
  traverse(applicative, fn) {
    const validation = this.value();

    if (validation[0] === "invalid") {
      return Applicative.pure(
        applicative,
        invalid_from_errors(
          validation[1],
        ),
      );
    }

    return Functor.map(fn(validation[1]), (value) => valid(value));
  },
});

export interface AsValidation extends Traversable<AsValidation> {}

function validation_valid<item>(value: item): Valid<item> {
  return ["valid", value];
}

function validation_invalid<item = never>(
  errors: readonly string[],
): Validation<item> {
  return ["invalid", errors];
}

function invalid_from_errors<item = never>(
  errors: readonly string[],
): ValidationValue<item> {
  return Validation(validation_invalid([...errors]));
}

function same_context<out>(value: unknown): out {
  return value as out;
}
