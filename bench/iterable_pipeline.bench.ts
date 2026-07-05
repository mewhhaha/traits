import {
  from_factory as iterable_from_factory,
  to_array as iterable_to_array,
} from "../src/iterable.ts";

type Step = (value: number) => number;

const item_count = 50_000;
const prefix_count = 100;
const source_items = Array.from(
  { length: item_count },
  (_item, index) => index,
);
const iterable_source = iterable_from_factory(function* () {
  yield* source_items;
});
const steps: readonly Step[] = [
  (value) => value + 1,
  (value) => value * 3,
  (value) => value - 7,
  (value) => value + value % 11,
  (value) => value * 2,
  (value) => value - value % 5,
];

let _sink = 0;

Deno.bench("iterable pipeline Array.map materializes each step", () => {
  _sink = sum_array(array_materialized_pipeline());
});

Deno.bench("iterable pipeline native generator maps lazy", () => {
  _sink = sum_iterable(native_lazy_pipeline());
});

Deno.bench("iterable pipeline IterableT maps lazy, final array", () => {
  _sink = sum_array(iterable_to_array(iterable_lazy_pipeline()));
});

Deno.bench("iterable pipeline IterableT maps lazy, folded", () => {
  _sink = iterable_lazy_pipeline().fold(0, (total, item) => total + item);
});

Deno.bench("iterable pipeline manual fused loop", () => {
  let total = 0;

  for (const item of source_items) {
    let current = item;

    for (const step of steps) {
      current = step(current);
    }

    total += current;
  }

  _sink = total;
});

Deno.bench("iterable pipeline Array.map materializes all, first 100", () => {
  _sink = sum_first_array(array_materialized_pipeline(), prefix_count);
});

Deno.bench("iterable pipeline native generator maps lazy, first 100", () => {
  _sink = sum_first_iterable(native_lazy_pipeline(), prefix_count);
});

Deno.bench("iterable pipeline IterableT maps lazy, first 100", () => {
  _sink = sum_first_iterable(iterable_lazy_pipeline().value()(), prefix_count);
});

function array_materialized_pipeline(): readonly number[] {
  let current: readonly number[] = source_items;

  for (const step of steps) {
    current = current.map(step);
  }

  return current;
}

function native_lazy_pipeline(): Iterable<number> {
  let current: Iterable<number> = source_items;

  for (const step of steps) {
    current = map_iterable(current, step);
  }

  return current;
}

function iterable_lazy_pipeline() {
  let current = iterable_source;

  for (const step of steps) {
    current = current.map(step);
  }

  return current;
}

function* map_iterable(
  source: Iterable<number>,
  fn: Step,
): Iterable<number> {
  for (const item of source) {
    yield fn(item);
  }
}

function sum_array(items: readonly number[]): number {
  let total = 0;

  for (const item of items) {
    total += item;
  }

  return total;
}

function sum_iterable(items: Iterable<number>): number {
  let total = 0;

  for (const item of items) {
    total += item;
  }

  return total;
}

function sum_first_array(items: readonly number[], count: number): number {
  let total = 0;

  for (let index = 0; index < count && index < items.length; index += 1) {
    total += items[index];
  }

  return total;
}

function sum_first_iterable(items: Iterable<number>, count: number): number {
  let total = 0;
  let seen = 0;

  for (const item of items) {
    total += item;
    seen += 1;

    if (seen >= count) {
      break;
    }
  }

  return total;
}
