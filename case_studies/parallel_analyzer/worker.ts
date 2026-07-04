import { serve_worker } from "../../src/parallel.ts";
import { analyze_source } from "./analyzer.ts";
import type { AnalyzeResult, SourceFile } from "./types.ts";

serve_worker<SourceFile, AnalyzeResult>(analyze_source);
