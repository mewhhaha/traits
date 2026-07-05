import {
  type As,
  define,
  type type_item,
  type type_value,
  type Value,
} from "./trait.ts";
import {
  Applicative,
  Comonad,
  compare_unknown,
  Eq,
  Foldable,
  Functor,
  Monad,
  Ord,
  Show,
  Traversable,
} from "./traits.ts";

export type Identity<item> = item;

export interface AsIdentity
  extends
    As<AsIdentity>,
    Show<AsIdentity>,
    Eq<AsIdentity>,
    Functor<AsIdentity>,
    Applicative<AsIdentity>,
    Monad<AsIdentity>,
    Foldable<AsIdentity>,
    Traversable<AsIdentity>,
    Comonad<AsIdentity>,
    Ord<AsIdentity> {
  readonly [type_item]: unknown;
  readonly [type_value]: Identity<this[typeof type_item]>;
}

export type IdentityValue<item> = Value<AsIdentity, item>;

export const Identity = define<AsIdentity>();

export function identity<item>(value: item): IdentityValue<item> {
  return Identity(value);
}

Show.implement(Identity)({
  show() {
    return "Identity(" + Deno.inspect(this.value()) + ")";
  },
});

Eq.implement(Identity)({
  eq(right) {
    return Object.is(this.value(), right.value());
  },
});

Ord.implement(Identity)({
  compare(right) {
    return compare_unknown(this.value(), right.value());
  },
});

Functor.implement(Identity)({
  map(fn) {
    return identity(fn(this.value()));
  },
});

Applicative.implement(Identity)({
  pure(value) {
    return identity(value);
  },

  ap(value) {
    return identity(this.value()(value.value()));
  },
});

Monad.implement(Identity)({
  bind(fn) {
    return fn(this.value());
  },
});

Foldable.implement(Identity)({
  fold(initial, fn) {
    return fn(initial, this.value());
  },
});

Traversable.implement(Identity)({
  traverse(_applicative, fn) {
    return Functor.map(fn(this.value()), identity);
  },
});

Comonad.implement(Identity)({
  extract() {
    return this.value();
  },

  extend(fn) {
    return identity(fn(this));
  },
});
