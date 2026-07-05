import {
  call_trait_method,
  define_trait,
  type Dictionary,
  type TraitDictionary,
  type Value,
} from "../trait.ts";

export const eq_trait = Symbol("Eq");

export interface Eq<dictionary extends Dictionary> extends
  TraitDictionary<
    dictionary,
    typeof eq_trait,
    {
      eq: <item>(
        this: Value<dictionary, item>,
        right: Value<dictionary, item>,
      ) => boolean;
    }
  > {}

export const Eq = define_trait(eq_trait, {
  eq<
    dictionary extends Eq<dictionary>,
    item,
  >(
    left: Value<dictionary, item>,
    right: Value<dictionary, item>,
  ): boolean {
    return call_trait_method(this.implementation(left).eq<item>, left, right);
  },
});
