import {
  call_trait_method,
  define_trait,
  type Dictionary,
  type Trait,
  type TraitDictionary,
} from "../trait.ts";

export const category_trait = Symbol("Category");

export interface Category<dictionary extends Dictionary>
  extends
    TraitDictionary<
      dictionary,
      typeof category_trait,
      {
        id: <item>(this: dictionary) => Trait<dictionary, unknown, item>;
        compose: <after_raw, before_raw, from, middle, to>(
          this: Trait<dictionary, after_raw, to>,
          before: Trait<dictionary, before_raw, middle>,
        ) => Trait<dictionary, unknown, to>;
      }
    > {}

export const Category = define_trait(category_trait, {
  id<
    dictionary extends Category<dictionary>,
    item,
  >(
    dictionary: dictionary,
  ): Trait<dictionary, unknown, item> {
    return call_trait_method(
      this.implementation(dictionary).id<item>,
      dictionary,
    );
  },

  compose<
    dictionary extends Category<dictionary>,
    after_raw,
    before_raw,
    from,
    middle,
    to,
  >(
    after: Trait<dictionary, after_raw, to>,
    before: Trait<dictionary, before_raw, middle>,
  ): Trait<dictionary, unknown, to> {
    return call_trait_method(
      this.implementation(after).compose<
        after_raw,
        before_raw,
        from,
        middle,
        to
      >,
      after,
      before,
    );
  },
});
