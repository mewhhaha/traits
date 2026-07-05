import { type HttpProblem, problem_message, problem_status } from "./types.ts";

export function json_response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export function no_content(): Response {
  return new Response(null, { status: 204 });
}

export function problem_response(problem: HttpProblem): Response {
  const [tag] = problem;

  return json_response(
    {
      error: {
        code: tag,
        message: problem_message(problem),
      },
    },
    problem_status(problem),
  );
}
