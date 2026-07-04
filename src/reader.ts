import { define, type Dictionary, type Trait, type Value } from "./trait.ts";
import { type Effect, handle_lift, type WithoutLift } from "./effects.ts";
import { Applicative, Format, Functor, Monad } from "./traits.ts";

export type Reader<environment, item> = (environment: environment) => item;

export const reader_kind = Symbol("Reader");

declare module "./trait.ts" {
  interface TraitTypes<dictionary, item> {
    [reader_kind]: dictionary extends AsReader<infer environment>
      ? Reader<environment, item>
      : never;
  }
}

export interface AsReader<environment> extends Dictionary<typeof reader_kind> {
  <item>(value: Reader<environment, item>): ReaderValue<environment, item>;
}

export type ReaderValue<environment, item> = Trait<
  AsReader<environment>,
  Reader<environment, item>,
  item
>;

type ReaderConstructor =
  & AsReader<unknown>
  & {
    <environment, item>(
      value: Reader<environment, item>,
    ): ReaderValue<environment, item>;
  };

export const Reader = define<AsReader<unknown>>(
  reader_kind,
) as ReaderConstructor;

export function ask<environment>(): ReaderValue<environment, environment> {
  return Reader((environment: environment) => environment);
}

export function asks<environment, item>(
  fn: (environment: environment) => item,
): ReaderValue<environment, item> {
  return Reader(fn);
}

export function local<outer, inner, item>(
  reader: ReaderValue<inner, item>,
  fn: (environment: outer) => inner,
): ReaderValue<outer, item> {
  return Reader((environment: outer) => reader.value()(fn(environment)));
}

export function run_reader<requirements, environment, item>(
  effect: Effect<requirements, item>,
  environment: environment,
): Effect<WithoutLift<requirements, AsReader<environment>>, item> {
  return handle_lift(effect, reader_kind, environment, {
    done(value: item) {
      return value;
    },

    handle(reader: Value<AsReader<environment>, unknown>, environment) {
      return [reader.value()(environment), environment];
    },
  });
}

Format.implement(Reader)({
  fmt() {
    return "Reader(?)";
  },
});

export interface AsReader<environment> extends Format<AsReader<environment>> {}

Functor.implement(Reader)({
  map(fn) {
    return Reader((environment: unknown) => {
      return fn(this.value()(environment));
    });
  },
});

export interface AsReader<environment> extends Functor<AsReader<environment>> {}

Applicative.implement(Reader)({
  pure(value) {
    return Reader((_environment: unknown) => value);
  },

  ap(value) {
    return Reader((environment: unknown) => {
      const fn = this.value()(environment);
      return fn(value.value()(environment));
    });
  },
});

export interface AsReader<environment>
  extends Applicative<AsReader<environment>> {}

Monad.implement(Reader)({
  bind(fn) {
    return Reader((environment: unknown) => {
      const value = this.value()(environment);
      return fn(value).value()(environment);
    });
  },
});

export interface AsReader<environment> extends Monad<AsReader<environment>> {}
