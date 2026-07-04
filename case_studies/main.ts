import { run_agent_harness_case_study } from "./agent_harness/mod.ts";
import { run_http_router_case_study } from "./http_router/mod.ts";
import { run_io_application_case_study } from "./io_application/mod.ts";
import { run_parallel_analyzer_case_study } from "./parallel_analyzer/mod.ts";
import { run_programming_language_parser_case_study } from "./programming_language_parser/mod.ts";

await run_http_router_case_study();
await run_io_application_case_study();
await run_agent_harness_case_study();
await run_parallel_analyzer_case_study();
run_programming_language_parser_case_study();
