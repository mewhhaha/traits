import {
  type As,
  define,
  type type_item,
  type type_value,
  type Value,
} from "./trait.ts";
import { Equal, Format } from "./traits.ts";

export type ErrorT = Error;

export interface AsError extends As<AsError>, Format<AsError>, Equal<AsError> {
  readonly [type_item]: unknown;
  readonly [type_value]: ErrorT;
}

type ErrorValue = Value<AsError, Error>;

export const ErrorT = define<AsError>();

export function from_error(error: Error): ErrorValue {
  return ErrorT(error) as ErrorValue;
}

Format.implement(ErrorT)({
  fmt() {
    return this.value().name + ": " + this.value().message;
  },
});

Equal.implement(ErrorT)({
  eq(right) {
    const left = this.value();
    const right_value = right.value();

    return left.name === right_value.name &&
      left.message === right_value.message &&
      Object.is(left.cause, right_value.cause);
  },
});
