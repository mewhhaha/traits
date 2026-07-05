import {
  type As,
  define,
  type type_item,
  type type_value,
  type Value,
} from "./trait.ts";
import { Contravariant, Monoid, Semigroup, Show } from "./traits.ts";

export type Predicate<item> = (value: item) => boolean;

export interface AsPredicate
  extends
    As<AsPredicate>,
    Show<AsPredicate>,
    Contravariant<AsPredicate>,
    Semigroup<AsPredicate>,
    Monoid<AsPredicate> {
  readonly [type_item]: unknown;
  readonly [type_value]: Predicate<this[typeof type_item]>;
}

export type PredicateValue<item> = Value<AsPredicate, item>;

export const Predicate = define<AsPredicate>();

export function predicate<item>(
  value: Predicate<item>,
): PredicateValue<item> {
  return Predicate(value);
}

export function test<item>(
  value: PredicateValue<item>,
  item: item,
): boolean {
  return value.run(item);
}

Show.implement(Predicate)({
  show() {
    return "Predicate(?)";
  },
});

Contravariant.implement(Predicate)({
  contramap(fn) {
    const test = this.value();

    return predicate((value) => {
      return test(fn(value));
    });
  },
});

Semigroup.implement(Predicate)({
  concat(right) {
    const left = this.value();
    const right_value = right.value();

    return predicate((value) => {
      if (!left(value)) {
        return false;
      }

      return right_value(value);
    });
  },
});

Monoid.implement(Predicate)({
  empty() {
    return predicate(() => true);
  },
});
