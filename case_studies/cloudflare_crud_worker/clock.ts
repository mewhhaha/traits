import {
  Effect,
  type Effect as AlgebraicEffect,
  type Operation,
  type TaggedOperation,
} from "../../src/effects.ts";

export type Now =
  & Operation<string>
  & {
    readonly tag: "clock.now";
  };

export type Clock = Now;

type WithoutClock<requirements> = requirements extends Clock ? never
  : requirements;

export function now(): AlgebraicEffect<Now, string> {
  return Effect.send({ tag: "clock.now" } as Now);
}

export function run_clock<requirements, item>(
  effect: AlgebraicEffect<requirements, item>,
  read_now: () => string,
): AlgebraicEffect<WithoutClock<requirements>, item> {
  if (effect.tag === "pure") {
    return Effect.pure(effect.value);
  }

  const operation = effect.operation as TaggedOperation;

  if (operation.tag === "clock.now") {
    return run_clock(effect.resume(read_now()), read_now);
  }

  return Effect.suspend(
    effect.operation as WithoutClock<requirements>,
    (value) => run_clock(effect.resume(value), read_now),
  );
}

export function fixed_clock(value: string): () => string {
  return () => value;
}

export function system_clock(): () => string {
  return () => new Date().toISOString();
}
