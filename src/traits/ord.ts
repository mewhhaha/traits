import {
  call_trait_method,
  define_trait,
  type Dictionary,
  type TraitDictionary,
  type Value,
} from "../trait.ts";
import type { Eq as EqDictionary } from "./eq.ts";

export type Ordering = "lt" | "eq" | "gt";

export const ord_trait = Symbol("Ord");

export interface Ord<dictionary extends Dictionary> extends
  TraitDictionary<
    dictionary,
    typeof ord_trait,
    {
      compare: <item>(
        this: Value<dictionary, item>,
        right: Value<dictionary, item>,
      ) => Ordering;
    }
  >,
  EqDictionary<dictionary> {}

export const Ord = define_trait(ord_trait, {
  compare<
    dictionary extends Ord<dictionary>,
    item,
  >(
    left: Value<dictionary, item>,
    right: Value<dictionary, item>,
  ): Ordering {
    return call_trait_method(
      this.implementation(left).compare<item>,
      left,
      right,
    );
  },

  lt<dictionary extends Ord<dictionary>, item>(
    left: Value<dictionary, item>,
    right: Value<dictionary, item>,
  ): boolean {
    return this.compare(left, right) === "lt";
  },

  lte<dictionary extends Ord<dictionary>, item>(
    left: Value<dictionary, item>,
    right: Value<dictionary, item>,
  ): boolean {
    return this.compare(left, right) !== "gt";
  },

  gt<dictionary extends Ord<dictionary>, item>(
    left: Value<dictionary, item>,
    right: Value<dictionary, item>,
  ): boolean {
    return this.compare(left, right) === "gt";
  },

  gte<dictionary extends Ord<dictionary>, item>(
    left: Value<dictionary, item>,
    right: Value<dictionary, item>,
  ): boolean {
    return this.compare(left, right) !== "lt";
  },

  min<dictionary extends Ord<dictionary>, item>(
    left: Value<dictionary, item>,
    right: Value<dictionary, item>,
  ): Value<dictionary, item> {
    if (this.lte(left, right)) {
      return left;
    }

    return right;
  },

  max<dictionary extends Ord<dictionary>, item>(
    left: Value<dictionary, item>,
    right: Value<dictionary, item>,
  ): Value<dictionary, item> {
    if (this.gte(left, right)) {
      return left;
    }

    return right;
  },
});

export function compare_unknown(left: unknown, right: unknown): Ordering {
  if (Object.is(left, right)) {
    return "eq";
  }

  if (left instanceof Date && right instanceof Date) {
    return compare_number(left.getTime(), right.getTime());
  }

  const left_type = typeof left;
  const right_type = typeof right;

  if (left_type === "number" && right_type === "number") {
    return compare_number(left as number, right as number);
  }

  if (left_type === "bigint" && right_type === "bigint") {
    return compare_bigint(left as bigint, right as bigint);
  }

  if (left_type === "string" && right_type === "string") {
    return compare_number(
      (left as string).localeCompare(right as string),
      0,
    );
  }

  if (left_type === "boolean" && right_type === "boolean") {
    return compare_number(Number(left), Number(right));
  }

  return compare_number(
    Deno.inspect(left).localeCompare(Deno.inspect(right)),
    0,
  );
}

export function compare_number(left: number, right: number): Ordering {
  if (left < right) {
    return "lt";
  }

  if (left > right) {
    return "gt";
  }

  return "eq";
}

function compare_bigint(left: bigint, right: bigint): Ordering {
  if (left < right) {
    return "lt";
  }

  if (left > right) {
    return "gt";
  }

  return "eq";
}
