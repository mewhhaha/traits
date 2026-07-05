import {
  call_trait_method,
  define_trait,
  type Dictionary,
  type Trait,
  type TraitDictionary,
} from "../trait.ts";
import type { Category as CategoryDictionary } from "./category.ts";

export const arrow_trait = Symbol("Arrow");

export interface Arrow<dictionary extends Dictionary> extends
  TraitDictionary<
    dictionary,
    typeof arrow_trait,
    {
      arr: <from, to>(
        this: dictionary,
        fn: (value: from) => to,
      ) => Trait<dictionary, unknown, to>;
      first: <raw, from, to, extra>(
        this: Trait<dictionary, raw, to>,
      ) => Trait<dictionary, unknown, readonly [to, extra]>;
      second: <raw, from, to, extra>(
        this: Trait<dictionary, raw, to>,
      ) => Trait<dictionary, unknown, readonly [extra, to]>;
    }
  >,
  CategoryDictionary<dictionary> {}

export const Arrow = define_trait(arrow_trait, {
  arr<
    dictionary extends Arrow<dictionary>,
    from,
    to,
  >(
    dictionary: dictionary,
    fn: (value: from) => to,
  ): Trait<dictionary, unknown, to> {
    return call_trait_method(
      this.implementation(dictionary).arr<from, to>,
      dictionary,
      fn,
    );
  },

  first<
    dictionary extends Arrow<dictionary>,
    raw,
    from,
    to,
    extra,
  >(
    arrow: Trait<dictionary, raw, to>,
  ): Trait<dictionary, unknown, readonly [to, extra]> {
    return call_trait_method(
      this.implementation(arrow).first<raw, from, to, extra>,
      arrow,
    );
  },

  second<
    dictionary extends Arrow<dictionary>,
    raw,
    from,
    to,
    extra,
  >(
    arrow: Trait<dictionary, raw, to>,
  ): Trait<dictionary, unknown, readonly [extra, to]> {
    return call_trait_method(
      this.implementation(arrow).second<raw, from, to, extra>,
      arrow,
    );
  },
});
