import {
  type As,
  define,
  type type_item,
  type type_value,
  type Value,
} from "./trait.ts";
import { Eq, Show } from "./traits.ts";

export type WeakMapT<item> = WeakMap<object, item>;

export interface AsWeakMap
  extends As<AsWeakMap>, Show<AsWeakMap>, Eq<AsWeakMap> {
  readonly [type_item]: unknown;
  readonly [type_value]: WeakMapT<this[typeof type_item]>;
}

type WeakMapValue<item> = Value<AsWeakMap, item>;

export const WeakMapT = define<AsWeakMap>();

export function from_entries<item>(
  entries: Iterable<readonly [object, item]>,
): WeakMapValue<item> {
  return WeakMapT(new WeakMap(entries));
}

Show.implement(WeakMapT)({
  show() {
    return "WeakMap(?)";
  },
});

Eq.implement(WeakMapT)({
  eq(right) {
    return Object.is(this.value(), right.value());
  },
});
