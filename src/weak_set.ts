import {
  type As,
  define,
  type type_item,
  type type_value,
  type Value,
} from "./trait.ts";
import { Eq, Show } from "./traits.ts";

export type WeakSetT<item = object> = WeakSet<object>;

export interface AsWeakSet
  extends As<AsWeakSet>, Show<AsWeakSet>, Eq<AsWeakSet> {
  readonly [type_item]: unknown;
  readonly [type_value]: WeakSetT<this[typeof type_item]>;
}

type WeakSetValue<item extends object> = Value<AsWeakSet, item>;

export const WeakSetT = define<AsWeakSet>();

export function from_iterable<item extends object>(
  items: Iterable<item>,
): WeakSetValue<item> {
  return WeakSetT(new WeakSet<object>(items));
}

Show.implement(WeakSetT)({
  show() {
    return "WeakSet(?)";
  },
});

Eq.implement(WeakSetT)({
  eq(right) {
    return Object.is(this.value(), right.value());
  },
});
