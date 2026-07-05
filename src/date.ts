import {
  type As,
  define,
  type type_item,
  type type_value,
  type Value,
} from "./trait.ts";
import { Equal, Format } from "./traits.ts";

export type DateT = Date;

export interface AsDate extends As<AsDate>, Format<AsDate>, Equal<AsDate> {
  readonly [type_item]: unknown;
  readonly [type_value]: DateT;
}

type DateValue = Value<AsDate, Date>;

export const DateT = define<AsDate>(
  function (date) {
    return this.as_trait(new Date(date.getTime()));
  },
);

export function from_date(date: Date): DateValue {
  return DateT(date) as DateValue;
}

Format.implement(DateT)({
  fmt() {
    return this.value().toISOString();
  },
});

Equal.implement(DateT)({
  eq(right) {
    return Object.is(this.value().getTime(), right.value().getTime());
  },
});
