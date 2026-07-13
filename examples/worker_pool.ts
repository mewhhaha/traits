import {
  with_worker_pool,
  worker_pool_map,
  type WorkerPool,
} from "../src/parallel.ts";
import type { LogShard, LogShardSummary } from "./worker_pool_job.ts";

const worker_url = new URL("./worker_pool_worker.ts", import.meta.url);

export type WorkerPoolScenario = {
  readonly batches: readonly (readonly LogShard[])[];
  readonly workers: number;
};

export type LogAnalysisReport = {
  readonly batches: number;
  readonly shards: number;
  readonly lines: number;
  readonly warnings: number;
  readonly errors: number;
  readonly characters: number;
  readonly checksum: number;
  readonly summaries: readonly LogShardSummary[];
};

export function run_worker_pool_scenario(
  scenario: WorkerPoolScenario,
): Promise<LogAnalysisReport> {
  return with_worker_pool(
    worker_url,
    async (pool: WorkerPool<LogShard, LogShardSummary>) => {
      const summaries: LogShardSummary[] = [];

      for (const batch of scenario.batches) {
        const pending_analysis = worker_pool_map(pool, batch);
        const batch_summaries = await pending_analysis.run();

        summaries.push(...batch_summaries);
      }

      let lines = 0;
      let warnings = 0;
      let errors = 0;
      let characters = 0;
      let checksum = 2_166_136_261;

      for (const summary of summaries) {
        lines += summary.lines;
        warnings += summary.warnings;
        errors += summary.errors;
        characters += summary.characters;
        checksum = Math.imul(checksum ^ summary.checksum, 16_777_619);
      }

      return {
        batches: scenario.batches.length,
        shards: summaries.length,
        lines,
        warnings,
        errors,
        characters,
        checksum: checksum >>> 0,
        summaries,
      };
    },
    { workers: scenario.workers },
  );
}

export async function run_worker_pool_examples() {
  const report = await run_worker_pool_scenario({
    workers: 2,
    batches: [
      [
        {
          id: "authentication",
          lines: [
            "INFO session opened",
            "WARN retrying token refresh",
            "ERROR token refresh failed",
          ],
        },
        {
          id: "billing",
          lines: [
            "INFO invoice created",
            "INFO payment captured",
            "WARN receipt delivery delayed",
          ],
        },
      ],
      [
        {
          id: "search",
          lines: [
            "ERROR index unavailable",
            "WARN serving stale results",
            "INFO recovery scheduled",
            "ERROR shard timeout",
          ],
        },
      ],
    ],
  });

  console.log(
    "worker pool summaries",
    Deno.inspect(report.summaries),
  );
  console.log(
    "worker pool totals",
    Deno.inspect({
      batches: report.batches,
      shards: report.shards,
      lines: report.lines,
      warnings: report.warnings,
      errors: report.errors,
      characters: report.characters,
      checksum: report.checksum,
    }),
  );
}
