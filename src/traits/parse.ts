import {
  call_trait_method,
  define_trait,
  type Dictionary,
  type Trait,
  type TraitDictionary,
} from "../trait.ts";

export const parse_trait = Symbol("Parse");

export interface Parse<dictionary extends Dictionary> extends
  TraitDictionary<
    dictionary,
    typeof parse_trait,
    {
      parse: <raw, item>(
        this: Trait<dictionary, raw, item>,
        input: string,
      ) => item;
    }
  > {}

export const Parse = define_trait(parse_trait, {
  parse<
    dictionary extends Parse<dictionary>,
    raw,
    item,
  >(
    parser: Trait<dictionary, raw, item>,
    input: string,
  ): item {
    return call_trait_method(
      this.implementation(parser).parse<raw, item>,
      parser,
      input,
    );
  },
});
