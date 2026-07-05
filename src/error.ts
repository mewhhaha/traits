import {
  type As,
  define,
  type type_item,
  type type_value,
  type Value,
} from "./trait.ts";
import { Eq, Show } from "./traits.ts";

export type ErrorT = Error;

export interface AsError extends As<AsError>, Show<AsError>, Eq<AsError> {
  readonly [type_item]: unknown;
  readonly [type_value]: ErrorT;
}

type ErrorValue = Value<AsError, Error>;

export const ErrorT = define<AsError>();

export function from_error(error: Error): ErrorValue {
  return ErrorT(error) as ErrorValue;
}

Show.implement(ErrorT)({
  show() {
    return this.value().name + ": " + this.value().message;
  },
});

Eq.implement(ErrorT)({
  eq(right) {
    const left = this.value();
    const right_value = right.value();

    return left.name === right_value.name &&
      left.message === right_value.message &&
      Object.is(left.cause, right_value.cause);
  },
});
