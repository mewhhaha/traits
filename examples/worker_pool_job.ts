export type LogShard = {
  readonly id: string;
  readonly lines: readonly string[];
};

export type LogShardSummary = {
  readonly id: string;
  readonly lines: number;
  readonly warnings: number;
  readonly errors: number;
  readonly characters: number;
  readonly checksum: number;
};

export function analyze_log_shard(shard: LogShard): LogShardSummary {
  let warnings = 0;
  let errors = 0;
  let characters = 0;
  let checksum = 2_166_136_261;

  for (const line of shard.lines) {
    if (line === "WARN" || line.startsWith("WARN ")) {
      warnings += 1;
    }

    if (line === "ERROR" || line.startsWith("ERROR ")) {
      errors += 1;
    }

    characters += line.length;

    for (let index = 0; index < line.length; index += 1) {
      checksum = Math.imul(checksum ^ line.charCodeAt(index), 16_777_619);
    }

    checksum = Math.imul(checksum ^ 10, 16_777_619);
  }

  return {
    id: shard.id,
    lines: shard.lines.length,
    warnings,
    errors,
    characters,
    checksum: checksum >>> 0,
  };
}
