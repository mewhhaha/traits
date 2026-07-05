import {
  type As,
  define,
  type type_item,
  type type_value,
  type Value,
} from "./trait.ts";
import { Eq, Show } from "./traits.ts";

export type DateT = Date;

export interface AsDate extends As<AsDate>, Show<AsDate>, Eq<AsDate> {
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

Show.implement(DateT)({
  show() {
    return this.value().toISOString();
  },
});

Eq.implement(DateT)({
  eq(right) {
    return Object.is(this.value().getTime(), right.value().getTime());
  },
});
