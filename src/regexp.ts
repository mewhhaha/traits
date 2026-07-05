import {
  type As,
  define,
  type type_item,
  type type_value,
  type Value,
} from "./trait.ts";
import { Eq, Show } from "./traits.ts";

export type RegExpT = RegExp;

export interface AsRegExp extends As<AsRegExp>, Show<AsRegExp>, Eq<AsRegExp> {
  readonly [type_item]: unknown;
  readonly [type_value]: RegExpT;
}

type RegExpValue = Value<AsRegExp, RegExp>;

export const RegExpT = define<AsRegExp>(
  function (regexp) {
    return this.as_trait(new RegExp(regexp.source, regexp.flags));
  },
);

export function from_regexp(regexp: RegExp): RegExpValue {
  return RegExpT(regexp) as RegExpValue;
}

Show.implement(RegExpT)({
  show() {
    return this.value().toString();
  },
});

Eq.implement(RegExpT)({
  eq(right) {
    const left = this.value();
    const right_value = right.value();

    return left.source === right_value.source &&
      left.flags === right_value.flags;
  },
});
