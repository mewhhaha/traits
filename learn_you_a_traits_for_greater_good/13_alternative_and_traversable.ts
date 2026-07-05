import {
  from_array as array_from_array,
  to_array as array_to_array,
} from "../src/array.ts";
import { assert_equals } from "../src/assert.ts";
import { left, right } from "../src/either.ts";
import { just, nothing } from "../src/maybe.ts";
import { Alternative, Traversable } from "../src/traits.ts";

export function lesson_13_alternative_and_traversable() {
  const fallback = Alternative.alt(nothing<number>(), just(42));
  const combined = Alternative.alt(
    array_from_array([1, 2]),
    array_from_array([3]),
  );
  const parsed = Traversable.traverse(
    array_from_array(["1", "2", "x"]),
    right(undefined),
    parse_int,
  );

  assert_equals(fallback.value(), just(42).value());
  assert_equals(array_to_array(combined), [1, 2, 3]);
  assert_equals(parsed.value(), left("expected integer: x").value());
}

function parse_int(text: string) {
  const value = Number.parseInt(text, 10);

  if (Number.isFinite(value)) {
    return right(value);
  }

  return left("expected integer: " + text);
}
