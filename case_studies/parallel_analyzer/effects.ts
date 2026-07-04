import {
  Effect,
  type Effect as AlgebraicEffect,
  type Operation,
  type TaggedOperation,
} from "../../src/effects.ts";
import { type Parallel, parallel_map } from "../../src/parallel.ts";
import type { AnalyzeResult, SourceFile } from "./types.ts";

export type AnalyzeSources =
  & Operation<readonly AnalyzeResult[]>
  & {
    readonly tag: "parallel_analyzer.analyze_sources";
    readonly files: readonly SourceFile[];
    readonly workers: number | undefined;
  };

export type AnalyzeSourcesOptions = {
  readonly workers?: number;
};

type WithoutAnalyzeSources<requirements> = requirements extends AnalyzeSources
  ? never
  : requirements;

export function analyze_sources(
  files: readonly SourceFile[],
  options: AnalyzeSourcesOptions = {},
): AlgebraicEffect<AnalyzeSources, readonly AnalyzeResult[]> {
  return Effect.send({
    tag: "parallel_analyzer.analyze_sources",
    files,
    workers: options.workers,
  } as AnalyzeSources);
}

export function run_analyze_sources_with_workers<requirements, item>(
  effect: AlgebraicEffect<requirements, item>,
  worker: string | URL,
): AlgebraicEffect<WithoutAnalyzeSources<requirements> | Parallel, item> {
  if (effect.tag === "pure") {
    return Effect.pure(effect.value);
  }

  const operation = effect.operation as TaggedOperation;

  if (operation.tag === "parallel_analyzer.analyze_sources") {
    const analyze = effect.operation as AnalyzeSources;

    return Effect.bind(
      parallel_map<SourceFile, AnalyzeResult>(worker, analyze.files, {
        workers: analyze.workers,
      }),
      (results) => {
        return run_analyze_sources_with_workers(
          effect.resume(results),
          worker,
        );
      },
    );
  }

  return Effect.suspend(
    effect.operation as WithoutAnalyzeSources<requirements>,
    (value) => run_analyze_sources_with_workers(effect.resume(value), worker),
  );
}
