import {
  call_trait_method,
  define_trait,
  type Dictionary,
  type Trait,
  type TraitDictionary,
} from "../trait.ts";

export const bifunctor_trait = Symbol("Bifunctor");

export interface Bifunctor<dictionary extends Dictionary>
  extends
    TraitDictionary<
      dictionary,
      typeof bifunctor_trait,
      {
        bimap: <raw, left, right, next_left, next_right>(
          this: Trait<dictionary, raw, right>,
          left: (value: left) => next_left,
          right: (value: right) => next_right,
        ) => Trait<dictionary, unknown, next_right>;
      }
    > {}

export const Bifunctor = define_trait(bifunctor_trait, {
  bimap<
    dictionary extends Bifunctor<dictionary>,
    raw,
    left,
    right,
    next_left,
    next_right,
  >(
    value: Trait<dictionary, raw, right>,
    left: (value: left) => next_left,
    right: (value: right) => next_right,
  ): Trait<dictionary, unknown, next_right> {
    return call_trait_method(
      this.implementation(value).bimap<
        raw,
        left,
        right,
        next_left,
        next_right
      >,
      value,
      left,
      right,
    );
  },

  map_left<
    dictionary extends Bifunctor<dictionary>,
    raw,
    left,
    right,
    next_left,
  >(
    value: Trait<dictionary, raw, right>,
    fn: (value: left) => next_left,
  ): Trait<dictionary, unknown, right> {
    return this.bimap(value, fn, identity);
  },
});

function identity<item>(value: item): item {
  return value;
}
