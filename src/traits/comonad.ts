import {
  call_trait_method,
  define_trait,
  type Dictionary,
  type TraitDictionary,
  type Value,
} from "../trait.ts";
import type { Functor as FunctorDictionary } from "./functor.ts";

export const comonad_trait = Symbol("Comonad");

export interface Comonad<dictionary extends Dictionary> extends
  TraitDictionary<
    dictionary,
    typeof comonad_trait,
    {
      extract: <item>(this: Value<dictionary, item>) => item;
      extend: <from, to>(
        this: Value<dictionary, from>,
        fn: (value: Value<dictionary, from>) => to,
      ) => Value<dictionary, to>;
    }
  >,
  FunctorDictionary<dictionary> {}

export const Comonad = define_trait(comonad_trait, {
  extract<
    dictionary extends Comonad<dictionary>,
    item,
  >(
    value: Value<dictionary, item>,
  ): item {
    return call_trait_method(
      this.implementation(value).extract<item>,
      value,
    );
  },

  extend<
    dictionary extends Comonad<dictionary>,
    from,
    to,
  >(
    value: Value<dictionary, from>,
    fn: (value: Value<dictionary, from>) => to,
  ): Value<dictionary, to> {
    return call_trait_method(
      this.implementation(value).extend<from, to>,
      value,
      fn,
    );
  },
});
