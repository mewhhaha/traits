import {
  type As,
  define,
  type Trait,
  type type_item,
  type type_value,
} from "./trait.ts";
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

export interface AsResult
  extends
    As<AsResult>,
    Format<AsResult>,
    Equal<AsResult>,
    Functor<AsResult>,
    Applicative<AsResult>,
    Monad<AsResult>,
    Foldable<AsResult>,
    Traversable<AsResult> {
  readonly [type_item]: unknown;
  readonly [type_value]: Result<this[typeof type_item], unknown>;
}

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

export const Result = define<AsResult>() as ResultConstructor;

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
