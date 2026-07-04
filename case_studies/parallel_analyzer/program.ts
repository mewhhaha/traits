import { type AsArray, from_array } from "../../src/array.ts";
import { Program, type Uses } from "../../src/effects.ts";
import { ask, type AsReader } from "../../src/reader.ts";
import { type AsWriter, tell } from "../../src/writer.ts";
import { analyze_sources, type AnalyzeSources } from "./effects.ts";
import { summarize_results } from "./report.ts";
import type { AnalyzerReport, SourceFile } from "./types.ts";

export type ParallelAnalyzerInput = {
  readonly files: readonly SourceFile[];
  readonly workers: number;
};

type AnalyzerLog = Uses<AsWriter<AsArray, string>>;

type AnalyzerApp =
  | Uses<AsReader<ParallelAnalyzerInput>>
  | AnalyzerLog
  | AnalyzeSources;

const AnalyzerApp = Program.scope<AnalyzerApp>();

export const parallel_analyzer = AnalyzerApp(function* () {
  const input = yield* ask<ParallelAnalyzerInput>();

  yield* log(
    "parallel analyzer workers=" + input.workers.toString() +
      " files=" + input.files.length.toString(),
  );

  const results = yield* analyze_sources(input.files, {
    workers: input.workers,
  });
  const report = summarize_results(results);

  yield* log(report_line(report));

  return report;
});

function log(line: string) {
  return tell(from_array([line]));
}

function report_line(report: AnalyzerReport): string {
  return "parallel analyzer parsed=" + report.parsed.toString() +
    " failed=" + report.failed.toString() +
    " declarations=" + report.declarations.toString();
}
