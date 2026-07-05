import {
  type As,
  define,
  type type_item,
  type type_value,
  type Value,
} from "./trait.ts";
import { Equal, Format } from "./traits.ts";

export type WeakSetT<item = object> = WeakSet<object>;

export interface AsWeakSet
  extends As<AsWeakSet>, Format<AsWeakSet>, Equal<AsWeakSet> {
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

Format.implement(WeakSetT)({
  fmt() {
    return "WeakSet(?)";
  },
});

Equal.implement(WeakSetT)({
  eq(right) {
    return Object.is(this.value(), right.value());
  },
});
