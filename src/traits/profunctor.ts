import {
  call_trait_method,
  define_trait,
  type Dictionary,
  type Trait,
  type TraitDictionary,
} from "../trait.ts";

export const profunctor_trait = Symbol("Profunctor");

export interface Profunctor<dictionary extends Dictionary>
  extends
    TraitDictionary<
      dictionary,
      typeof profunctor_trait,
      {
        dimap: <raw, from, to, next_from, next_to>(
          this: Trait<dictionary, raw, to>,
          input: (value: next_from) => from,
          output: (value: to) => next_to,
        ) => Trait<dictionary, unknown, next_to>;
      }
    > {}

export const Profunctor = define_trait(profunctor_trait, {
  dimap<
    dictionary extends Profunctor<dictionary>,
    raw,
    from,
    to,
    next_from,
    next_to,
  >(
    value: Trait<dictionary, raw, to>,
    input: (value: next_from) => from,
    output: (value: to) => next_to,
  ): Trait<dictionary, unknown, next_to> {
    return call_trait_method(
      this.implementation(value).dimap<raw, from, to, next_from, next_to>,
      value,
      input,
      output,
    );
  },

  lmap<
    dictionary extends Profunctor<dictionary>,
    raw,
    from,
    to,
    next_from,
  >(
    value: Trait<dictionary, raw, to>,
    input: (value: next_from) => from,
  ): Trait<dictionary, unknown, to> {
    return this.dimap(value, input, identity);
  },

  rmap<
    dictionary extends Profunctor<dictionary>,
    raw,
    from,
    to,
    next_to,
  >(
    value: Trait<dictionary, raw, to>,
    output: (value: to) => next_to,
  ): Trait<dictionary, unknown, next_to> {
    return this.dimap(value, identity<from>, output);
  },
});

function identity<item>(value: item): item {
  return value;
}
