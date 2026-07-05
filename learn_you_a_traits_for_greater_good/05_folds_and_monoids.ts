import {
  from_array as array_from_array,
  to_array as array_to_array,
} from "../src/array.ts";
import { assert_equals } from "../src/assert.ts";
import {
  from_array as list_from_array,
  to_array as list_to_array,
} from "../src/list.ts";
import { Foldable, Monoid, Semigroup } from "../src/traits.ts";

export function lesson_05_folds_and_monoids() {
  const numbers = list_from_array([1, 2, 3, 4]);
  const left = array_from_array(["learn"]);
  const right = array_from_array(["traits"]);
  const empty = Monoid.empty(array_from_array<string>([]));

  const total = Foldable.fold(numbers, 0, (state, item) => state + item);
  const combined = Semigroup.concat(left, right);
  const with_empty = Monoid.concat(empty, combined);

  assert_equals(total, 10);
  assert_equals(array_to_array(with_empty), ["learn", "traits"]);
  assert_equals(list_to_array(numbers), [1, 2, 3, 4]);
}
