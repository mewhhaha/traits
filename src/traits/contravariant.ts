import {
  call_trait_method,
  define_trait,
  type Dictionary,
  type TraitDictionary,
  type Value,
} from "../trait.ts";

export const contravariant_trait = Symbol("Contravariant");

export interface Contravariant<dictionary extends Dictionary>
  extends
    TraitDictionary<
      dictionary,
      typeof contravariant_trait,
      {
        contramap: <from, to>(
          this: Value<dictionary, from>,
          fn: (value: to) => from,
        ) => Value<dictionary, to>;
      }
    > {}

export const Contravariant = define_trait(contravariant_trait, {
  contramap<
    dictionary extends Contravariant<dictionary>,
    from,
    to,
  >(
    value: Value<dictionary, from>,
    fn: (value: to) => from,
  ): Value<dictionary, to> {
    return call_trait_method(
      this.implementation(value).contramap<from, to>,
      value,
      fn,
    );
  },
});
