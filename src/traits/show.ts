import {
  call_trait_method,
  define_trait,
  type Dictionary,
  type TraitDictionary,
  type Value,
} from "../trait.ts";

export const show_trait = Symbol("Show");

export interface Show<dictionary extends Dictionary> extends
  TraitDictionary<
    dictionary,
    typeof show_trait,
    {
      show: (this: Value<dictionary, unknown>) => string;
    }
  > {}

export const Show = define_trait(show_trait, {
  show<dictionary extends Show<dictionary>>(
    value: Value<dictionary, unknown>,
  ): string {
    return call_trait_method(this.implementation(value).show, value);
  },
});
