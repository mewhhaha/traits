import { memory_database } from "./database.ts";
import { handle_request_with_trace_log } from "./worker.ts";

const base = "https://worker.example.test";

export async function run_cloudflare_crud_worker_case_study() {
  const database = memory_database([
    {
      id: "seed",
      title: "ship tracing",
      completed: false,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ]);

  const requests = [
    new Request(base + "/todos"),
    json_request("POST", "/todos", {
      title: "write case study",
      completed: false,
    }),
    json_request("PATCH", "/todos/2", {
      completed: true,
    }),
    new Request(base + "/todos/2"),
    new Request(base + "/todos/seed", { method: "DELETE" }),
    new Request(base + "/todos/seed"),
  ];

  for (let index = 0; index < requests.length; index += 1) {
    const request = requests[index];
    const result = await handle_request_with_trace_log(request, database, {
      request_id: "demo-" + (index + 1).toString(),
      now: "2026-01-01T00:00:0" + index.toString() + ".000Z",
    });
    const url = new URL(request.url);

    console.log(
      "cloudflare crud",
      request.method,
      url.pathname,
      result.response.status,
    );

    if (result.response.status !== 204) {
      console.log("cloudflare crud body", await result.response.text());
    }

    for (const line of result.trace) {
      console.log("cloudflare crud", line);
    }
  }
}

function json_request(
  method: string,
  path: string,
  body: unknown,
): Request {
  return new Request(base + path, {
    method,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
