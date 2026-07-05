import {
  type As,
  define,
  type Trait,
  type type_item,
  type type_value,
} from "./trait.ts";
import {
  Applicative,
  Eq,
  Foldable,
  Functor,
  Monad,
  Show,
  Traversable,
} from "./traits.ts";

export type Either<left, right> =
  | Left<left>
  | Right<right>;

export type Left<left = string> = readonly ["left", left];
export type Right<right> = readonly ["right", right];

export interface AsEither
  extends
    As<AsEither>,
    Show<AsEither>,
    Eq<AsEither>,
    Functor<AsEither>,
    Applicative<AsEither>,
    Monad<AsEither>,
    Foldable<AsEither>,
    Traversable<AsEither> {
  readonly [type_item]: unknown;
  readonly [type_value]: Either<unknown, this[typeof type_item]>;
}

export type EitherValue<left, right> = Trait<
  AsEither,
  Either<left, right>,
  right
>;

type EitherConstructor =
  & AsEither
  & {
    <left, right>(value: Either<left, right>): EitherValue<left, right>;
  };

export const Either = define<AsEither>() as EitherConstructor;

export function right<right>(value: right): EitherValue<never, right> {
  return Either(either_right(value)) as EitherValue<never, right>;
}

export function left<left = string, right = never>(
  value: left,
): EitherValue<left, right> {
  return Either(either_left<left, right>(value)) as EitherValue<left, right>;
}

export function is_left<left, right>(
  value: Either<left, right>,
): value is Left<left> {
  const [tag] = value;

  return tag === "left";
}

export function is_right<left, right>(
  value: Either<left, right>,
): value is Right<right> {
  const [tag] = value;

  return tag === "right";
}

export function from_number(value: number) {
  if (Number.isFinite(value)) {
    return right(value);
  }

  return left("Expected a finite number");
}

Show.implement(Either)({
  show() {
    const [tag, payload] = this.value();

    switch (tag) {
      case "right":
        return "Right(" + Deno.inspect(payload) + ")";
      case "left":
        return "Left(" + Deno.inspect(payload) + ")";
    }
  },
});

Eq.implement(Either)({
  eq(right) {
    const [left_tag, left_payload] = this.value();
    const [right_tag, right_payload] = right.value();

    switch (left_tag) {
      case "left":
        switch (right_tag) {
          case "left":
            return Object.is(left_payload, right_payload);
          case "right":
            return false;
        }
        break;
      case "right":
        switch (right_tag) {
          case "left":
            return false;
          case "right":
            return Object.is(left_payload, right_payload);
        }
        break;
    }

    return false;
  },
});

Functor.implement(Either)({
  map(fn) {
    const [tag, payload] = this.value();

    switch (tag) {
      case "left":
        return same_context(this);
      case "right":
        return right(fn(payload));
    }
  },
});

Applicative.implement(Either)({
  pure(value) {
    return right(value);
  },

  ap(value) {
    const [fn_tag, fn] = this.value();

    switch (fn_tag) {
      case "left":
        return same_context(this);
      case "right": {
        const [either_tag, either] = value.value();

        switch (either_tag) {
          case "left":
            return same_context(value);
          case "right":
            return right(fn(either));
        }
      }
    }
  },
});

Monad.implement(Either)({
  bind(fn) {
    const [tag, payload] = this.value();

    switch (tag) {
      case "left":
        return same_context(this);
      case "right":
        return fn(payload);
    }
  },
});

Foldable.implement(Either)({
  fold(initial, fn) {
    const [tag, payload] = this.value();

    switch (tag) {
      case "left":
        return initial;
      case "right":
        return fn(initial, payload);
    }
  },
});

Traversable.implement(Either)({
  traverse(applicative, fn) {
    const [tag, payload] = this.value();

    switch (tag) {
      case "left":
        return Applicative.pure(applicative, left(payload));
      case "right":
        return Functor.map(fn(payload), (value) => right(value));
    }
  },
});

function either_right<right>(value: right): Right<right> {
  return ["right", value];
}

function either_left<left = string, right = never>(
  value: left,
): Either<left, right> {
  return ["left", value];
}

function same_context<out>(value: unknown): out {
  return value as out;
}
