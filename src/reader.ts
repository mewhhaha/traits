import { define, type Dictionary, kind, type Trait } from "./trait.ts";
import {
  type Effect,
  type Lift,
  pure,
  suspend,
  type WithoutLift,
} from "./effects.ts";
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
  if (effect.tag === "pure") {
    return pure(effect.value);
  }

  const operation = effect.operation as {
    readonly tag?: string;
    readonly value?: unknown;
  };

  if (operation.tag === "lift" && is_reader_value(operation.value)) {
    const lifted = effect.operation as unknown as Lift<
      AsReader<environment>,
      unknown
    >;
    return run_reader(
      effect.resume(lifted.value.value()(environment)),
      environment,
    );
  }

  return suspend(
    effect.operation as WithoutLift<requirements, AsReader<environment>>,
    (value) => run_reader(effect.resume(value), environment),
  ) as Effect<WithoutLift<requirements, AsReader<environment>>, item>;
}

function is_reader_value(value: unknown): value is Dictionary {
  if (typeof value !== "object") {
    return false;
  }

  if (value === null) {
    return false;
  }

  return (value as Dictionary)[kind] === reader_kind;
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
