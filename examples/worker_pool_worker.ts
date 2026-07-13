import { serve_worker } from "../src/parallel.ts";
import {
  analyze_log_shard,
  type LogShard,
  type LogShardSummary,
} from "./worker_pool_job.ts";

serve_worker<LogShard, LogShardSummary>(analyze_log_shard);
