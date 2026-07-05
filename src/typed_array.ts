import {
  type As,
  define,
  type type_item,
  type type_value,
  type Value,
} from "./trait.ts";
import { Equal, Foldable, Format } from "./traits.ts";

export type NumericTypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;

export type BigIntTypedArray = BigInt64Array | BigUint64Array;

type AnyTypedArray = NumericTypedArray | BigIntTypedArray;
type TypedArrayItem<array> = array extends BigIntTypedArray ? bigint : number;

export type TypedArrayT<item = number | bigint> = AnyTypedArray;

export interface AsTypedArray
  extends
    As<AsTypedArray>,
    Format<AsTypedArray>,
    Equal<AsTypedArray>,
    Foldable<AsTypedArray> {
  readonly [type_item]: unknown;
  readonly [type_value]: TypedArrayT<this[typeof type_item]>;
}

type TypedArrayValue<item> = Value<AsTypedArray, item>;

export const TypedArrayT = define<AsTypedArray>(
  function (array) {
    return this.as_trait(clone_typed_array(array));
  },
);

export function from_typed_array<array extends AnyTypedArray>(
  array: array,
): TypedArrayValue<TypedArrayItem<array>> {
  return TypedArrayT(array);
}

export function to_typed_array<item>(
  array: TypedArrayValue<item>,
): TypedArrayT<item> {
  return clone_typed_array(array.value()) as TypedArrayT<item>;
}

Format.implement(TypedArrayT)({
  fmt() {
    return Deno.inspect(this.value());
  },
});

Equal.implement(TypedArrayT)({
  eq(right) {
    const left = this.value();
    const right_value = right.value();

    if (left.constructor !== right_value.constructor) {
      return false;
    }

    if (left.length !== right_value.length) {
      return false;
    }

    for (let index = 0; index < left.length; index += 1) {
      if (!Object.is(left[index], right_value[index])) {
        return false;
      }
    }

    return true;
  },
});

Foldable.implement(TypedArrayT)({
  fold<item, out>(
    this: Value<AsTypedArray, item>,
    initial: out,
    fn: (state: out, item: item) => out,
  ) {
    let state = initial;

    for (const item of this.value()) {
      state = fn(state, item as unknown as item);
    }

    return state;
  },
});

function clone_typed_array(array: AnyTypedArray): AnyTypedArray {
  const out = same_constructor(array, array.length);
  copy_into(out, array, 0);

  return out;
}

function same_constructor(array: AnyTypedArray, length: number): AnyTypedArray {
  const constructor = array.constructor as new (
    length: number,
  ) => AnyTypedArray;
  return new constructor(length);
}

function copy_into(
  out: AnyTypedArray,
  input: AnyTypedArray,
  offset: number,
) {
  const target = out as {
    set(items: ArrayLike<number | bigint>, offset?: number): void;
  };

  target.set(input as ArrayLike<number | bigint>, offset);
}
