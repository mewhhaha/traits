import { ArrayT, type AsArray } from "../../src/array.ts";
import {
  Effect,
  type Effect as AlgebraicEffect,
  type Operation,
  type TaggedOperation,
  type Uses,
} from "../../src/effects.ts";
import { type AsTask, from_fn } from "../../src/task.ts";
import { type AsWriter, tell } from "../../src/writer.ts";

export type TraceAttributes = Readonly<
  Record<string, string | number | boolean>
>;

export type TraceEvent =
  & Operation<void>
  & {
    readonly tag: "trace.event";
    readonly name: string;
    readonly attributes: TraceAttributes;
  };

export type Trace = TraceEvent;

export type TraceRecord = {
  readonly name: string;
  readonly attributes: TraceAttributes;
};

export type TraceScope = {
  readonly name: string;
  readonly attributes?: TraceAttributes;
  readonly finish_attributes?: (value: unknown) => TraceAttributes;
};

export type TraceScopeSelector<requirements> = (
  operation: requirements,
) => TraceScope | undefined;

export type TraceSink = {
  event(record: TraceRecord): Promise<void>;
};

type WithoutTrace<requirements> = requirements extends Trace ? never
  : requirements;

export function trace_event(
  name: string,
  attributes: TraceAttributes = {},
): AlgebraicEffect<TraceEvent, void> {
  return Effect.send({
    tag: "trace.event",
    name,
    attributes,
  } as TraceEvent);
}

export function run_trace_scopes<requirements, item>(
  effect: AlgebraicEffect<requirements, item>,
  select_scope: TraceScopeSelector<requirements>,
): AlgebraicEffect<requirements | Trace, item> {
  if (effect.tag === "pure") {
    return Effect.pure(effect.value);
  }

  const scope = select_scope(effect.operation);

  if (scope === undefined) {
    return Effect.suspend(
      effect.operation as requirements | Trace,
      (value) => run_trace_scopes(effect.resume(value), select_scope),
    );
  }

  return Effect.bind(
    trace_event(scope.name + ".start", scope.attributes),
    () =>
      Effect.suspend(
        effect.operation as requirements | Trace,
        (value) =>
          Effect.bind(
            trace_event(
              scope.name + ".finish",
              trace_scope_finish_attributes(scope, value),
            ),
            () => run_trace_scopes(effect.resume(value), select_scope),
          ),
      ),
  );
}

export function run_trace_to_writer<requirements, item>(
  effect: AlgebraicEffect<requirements, item>,
): AlgebraicEffect<
  WithoutTrace<requirements> | Uses<AsWriter<AsArray, string>>,
  item
> {
  if (effect.tag === "pure") {
    return Effect.pure(effect.value);
  }

  const operation = effect.operation as TaggedOperation;

  if (operation.tag === "trace.event") {
    const trace = effect.operation as TraceEvent;

    return Effect.bind(
      Effect.lift(tell(ArrayT([format_trace(trace)]))),
      () => run_trace_to_writer(effect.resume(undefined)),
    );
  }

  return Effect.suspend(
    effect.operation as WithoutTrace<requirements>,
    (value) => run_trace_to_writer(effect.resume(value)),
  );
}

export function run_trace_with_sink<requirements, item>(
  effect: AlgebraicEffect<requirements, item>,
  sink: TraceSink,
): AlgebraicEffect<WithoutTrace<requirements> | Uses<AsTask>, item> {
  if (effect.tag === "pure") {
    return Effect.pure(effect.value);
  }

  const operation = effect.operation as TaggedOperation;

  if (operation.tag === "trace.event") {
    const trace = effect.operation as TraceEvent;

    return Effect.bind(
      Effect.lift(
        from_fn(() =>
          sink.event({
            name: trace.name,
            attributes: trace.attributes,
          })
        ),
      ),
      () => run_trace_with_sink(effect.resume(undefined), sink),
    );
  }

  return Effect.suspend(
    effect.operation as WithoutTrace<requirements>,
    (value) => run_trace_with_sink(effect.resume(value), sink),
  );
}

export function console_trace_sink(): TraceSink {
  return {
    event(record) {
      console.log(format_trace_record(record));
      return Promise.resolve();
    },
  };
}

export function format_trace(record: TraceEvent): string {
  return format_trace_record({
    name: record.name,
    attributes: record.attributes,
  });
}

function format_trace_record(record: TraceRecord): string {
  const attributes = Object.entries(record.attributes);

  if (attributes.length === 0) {
    return "trace " + record.name;
  }

  return "trace " + record.name + " " +
    attributes
      .map(([key, value]) => key + "=" + String(value))
      .join(" ");
}

function trace_scope_finish_attributes(
  scope: TraceScope,
  value: unknown,
): TraceAttributes {
  if (scope.finish_attributes === undefined) {
    return {};
  }

  return scope.finish_attributes(value);
}
