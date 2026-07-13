import {
  type AsStm,
  atomically,
  modify_tvar,
  new_tvar,
  or_else,
  read_tvar,
  retry,
  Stm,
  type TVar,
  write_tvar,
} from "../src/stm.ts";
import type { Data } from "../src/typeclass.ts";
import { Applicative, Do } from "../src/typeclasses.ts";

type LocalWorkerId = "primary" | "overflow";

export type QueuedRequest = {
  readonly request_id: string;
  readonly ticket: number;
};

export type RequestAdmission =
  | {
    readonly status: "assigned";
    readonly request_id: string;
    readonly worker_id: LocalWorkerId;
    readonly ticket: number;
  }
  | {
    readonly status: "rejected";
    readonly request_id: string;
    readonly reason: "all local worker queues are full";
  };

export type StmCoordinationReport = {
  readonly admissions: readonly RequestAdmission[];
  readonly primary_queue: readonly QueuedRequest[];
  readonly overflow_queue: readonly QueuedRequest[];
  readonly last_ticket: number;
};

type LocalWorkerQueue = {
  readonly id: LocalWorkerId;
  readonly capacity: number;
  readonly requests: TVar<readonly QueuedRequest[]>;
};

// This models immediate admission on one JavaScript isolate. retry selects a
// fallback transaction; it does not wait or coordinate shared Web Workers.
export function run_stm_coordination_scenario(): StmCoordinationReport {
  const primary: LocalWorkerQueue = {
    id: "primary",
    capacity: 1,
    requests: new_tvar<readonly QueuedRequest[]>([]),
  };
  const overflow: LocalWorkerQueue = {
    id: "overflow",
    capacity: 2,
    requests: new_tvar<readonly QueuedRequest[]>([]),
  };
  const last_ticket = new_tvar(0);
  const admissions: RequestAdmission[] = [];

  for (
    const request_id of [
      "request-1",
      "request-2",
      "request-3",
      "request-4",
    ]
  ) {
    admissions.push(
      admit_request_locally(primary, overflow, last_ticket, request_id),
    );
  }

  const queues = atomically(Do(function* () {
    const primary_queue = yield* read_tvar(primary.requests);
    const overflow_queue = yield* read_tvar(overflow.requests);
    const current_ticket = yield* read_tvar(last_ticket);

    return { primary_queue, overflow_queue, current_ticket };
  }));

  return {
    admissions,
    primary_queue: queues.primary_queue,
    overflow_queue: queues.overflow_queue,
    last_ticket: queues.current_ticket,
  };
}

export function run_stm_coordination_examples() {
  const report = run_stm_coordination_scenario();

  console.log("stm local synchronous admission", Deno.inspect(report));
}

function admit_request_locally(
  primary: LocalWorkerQueue,
  overflow: LocalWorkerQueue,
  last_ticket: TVar<number>,
  request_id: string,
): RequestAdmission {
  const rejected: RequestAdmission = {
    status: "rejected",
    request_id,
    reason: "all local worker queues are full",
  };
  const admission = or_else(
    try_admit_request(primary, last_ticket, request_id),
    or_else(
      try_admit_request(overflow, last_ticket, request_id),
      Applicative.pure(Stm, rejected),
    ),
  );

  return atomically(admission);
}

function try_admit_request(
  worker: LocalWorkerQueue,
  last_ticket: TVar<number>,
  request_id: string,
): Data<AsStm, RequestAdmission> {
  return Do(function* () {
    // Allocating first makes retry's rollback visible: a full queue does not
    // consume a ticket before the fallback queue is attempted.
    const ticket = yield* modify_tvar(last_ticket, (current) => current + 1);
    const requests = yield* read_tvar(worker.requests);

    if (requests.length >= worker.capacity) {
      return yield* retry<RequestAdmission>();
    }

    yield* write_tvar(worker.requests, [
      ...requests,
      { request_id, ticket },
    ]);

    return {
      status: "assigned",
      request_id,
      worker_id: worker.id,
      ticket,
    };
  });
}
