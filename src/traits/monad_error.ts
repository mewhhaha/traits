import {
  call_trait_method,
  define_trait,
  type Dictionary,
  type TraitDictionary,
  type Value,
} from "../trait.ts";
import type { Monad as MonadDictionary } from "./monad.ts";

export const monad_error_trait = Symbol("MonadError");

export interface MonadError<dictionary extends Dictionary>
  extends
    TraitDictionary<
      dictionary,
      typeof monad_error_trait,
      {
        throw_error: <item>(
          this: Value<dictionary, unknown>,
          error: unknown,
        ) => Value<dictionary, item>;
        catch_error: <item>(
          this: Value<dictionary, item>,
          handler: (error: unknown) => Value<dictionary, item>,
        ) => Value<dictionary, item>;
      }
    >,
    MonadDictionary<dictionary> {}

export const MonadError = define_trait(monad_error_trait, {
  throw_error<
    dictionary extends MonadError<dictionary>,
    item,
  >(
    witness: Value<dictionary, unknown>,
    error: unknown,
  ): Value<dictionary, item> {
    return call_trait_method(
      this.implementation(witness).throw_error<item>,
      witness,
      error,
    );
  },

  catch_error<
    dictionary extends MonadError<dictionary>,
    item,
  >(
    value: Value<dictionary, item>,
    handler: (error: unknown) => Value<dictionary, item>,
  ): Value<dictionary, item> {
    return call_trait_method(
      this.implementation(value).catch_error<item>,
      value,
      handler,
    );
  },
});
