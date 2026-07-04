import { type As, define, type Trait } from "./trait.ts";
import {
  Applicative,
  Equal,
  Foldable,
  Format,
  Functor,
  Monad,
  Traversable,
} from "./traits.ts";

export type Result<item, error = string> =
  | Ok<item>
  | Err<error>;

export type Ok<item> = readonly ["ok", item];
export type Err<error = string> = readonly ["err", error];

export const result_kind = Symbol("Result");

declare module "./trait.ts" {
  interface TraitTypes<dictionary, item> {
    [result_kind]: Result<item, unknown>;
  }
}

export interface AsResult extends As<typeof result_kind> {}

export type ResultValue<error, item> = Trait<
  AsResult,
  Result<item, error>,
  item
>;

type ResultConstructor =
  & AsResult
  & {
    <item, error>(value: Result<item, error>): ResultValue<error, item>;
  };

export const Result = define<AsResult>(
  result_kind,
) as ResultConstructor;

export function ok<item>(value: item): ResultValue<never, item> {
  return Result(result_ok(value)) as ResultValue<never, item>;
}

export function err<item = never, error = string>(
  error: error,
): ResultValue<error, item> {
  return Result(result_err<item, error>(error)) as ResultValue<error, item>;
}

export function is_ok<item, error>(
  value: Result<item, error>,
): value is Ok<item> {
  const [tag] = value;

  return tag === "ok";
}

export function is_err<item, error>(
  value: Result<item, error>,
): value is Err<error> {
  const [tag] = value;

  return tag === "err";
}

export function from_number(value: number) {
  if (Number.isFinite(value)) {
    return ok(value);
  }

  return err("Expected a finite number");
}

Format.implement(Result)({
  fmt() {
    const [tag, payload] = this.value();

    switch (tag) {
      case "ok":
        return "Ok(" + Deno.inspect(payload) + ")";
      case "err":
        return "Err(" + Deno.inspect(payload) + ")";
    }
  },
});

export interface AsResult extends Format<AsResult> {}

Equal.implement(Result)({
  eq(right) {
    const [left_tag, left_payload] = this.value();
    const [right_tag, right_payload] = right.value();

    switch (left_tag) {
      case "err":
        switch (right_tag) {
          case "err":
            return Object.is(left_payload, right_payload);
          case "ok":
            return false;
        }
        break;
      case "ok":
        switch (right_tag) {
          case "err":
            return false;
          case "ok":
            return Object.is(left_payload, right_payload);
        }
        break;
    }

    return false;
  },
});

export interface AsResult extends Equal<AsResult> {}

Functor.implement(Result)({
  map(fn) {
    const [tag, payload] = this.value();

    switch (tag) {
      case "err":
        return same_context(this);
      case "ok":
        return ok(fn(payload));
    }
  },
});

export interface AsResult extends Functor<AsResult> {}

Applicative.implement(Result)({
  pure(value) {
    return ok(value);
  },

  ap(value) {
    const [fn_tag, fn] = this.value();

    switch (fn_tag) {
      case "err":
        return same_context(this);
      case "ok": {
        const [result_tag, result] = value.value();

        switch (result_tag) {
          case "err":
            return same_context(value);
          case "ok":
            return ok(fn(result));
        }
      }
    }
  },
});

export interface AsResult extends Applicative<AsResult> {}

Monad.implement(Result)({
  bind(fn) {
    const [tag, payload] = this.value();

    switch (tag) {
      case "err":
        return same_context(this);
      case "ok":
        return fn(payload);
    }
  },
});

export interface AsResult extends Monad<AsResult> {}

Foldable.implement(Result)({
  fold(initial, fn) {
    const [tag, payload] = this.value();

    switch (tag) {
      case "err":
        return initial;
      case "ok":
        return fn(initial, payload);
    }
  },
});

export interface AsResult extends Foldable<AsResult> {}

Traversable.implement(Result)({
  traverse(applicative, fn) {
    const [tag, payload] = this.value();

    switch (tag) {
      case "err":
        return Applicative.pure(applicative, err(payload));
      case "ok":
        return Functor.map(fn(payload), (value) => ok(value));
    }
  },
});

export interface AsResult extends Traversable<AsResult> {}

function result_ok<item>(value: item): Ok<item> {
  return ["ok", value];
}

function result_err<item = never, error = string>(
  error: error,
): Result<item, error> {
  return ["err", error];
}

function same_context<out>(value: unknown): out {
  return value as out;
}
