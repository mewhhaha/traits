import {
  type As,
  define,
  type type_item,
  type type_value,
  type Value,
} from "./trait.ts";
import { Eq, Foldable, Monoid, Semigroup, Show } from "./traits.ts";

export type ArrayBufferT = ArrayBuffer;

export interface AsArrayBuffer
  extends
    As<AsArrayBuffer>,
    Show<AsArrayBuffer>,
    Eq<AsArrayBuffer>,
    Semigroup<AsArrayBuffer>,
    Monoid<AsArrayBuffer>,
    Foldable<AsArrayBuffer> {
  readonly [type_item]: unknown;
  readonly [type_value]: ArrayBufferT;
}

type ArrayBufferValue = Value<AsArrayBuffer, number>;

export const ArrayBufferT = define<AsArrayBuffer>(
  function (buffer) {
    return this.as_trait(buffer.slice(0));
  },
);

export function from_bytes(bytes: ArrayLike<number>): ArrayBufferValue {
  return ArrayBufferT(Uint8Array.from(bytes).buffer);
}

export function to_bytes(buffer: ArrayBufferValue): Uint8Array {
  return new Uint8Array(buffer.value().slice(0));
}

Show.implement(ArrayBufferT)({
  show() {
    return Deno.inspect(new Uint8Array(this.value()));
  },
});

Eq.implement(ArrayBufferT)({
  eq(right) {
    return bytes_equal(
      new Uint8Array(this.value()),
      new Uint8Array(right.value()),
    );
  },
});

Semigroup.implement(ArrayBufferT)({
  concat(right) {
    const left = new Uint8Array(this.value());
    const right_value = new Uint8Array(right.value());
    const out = new Uint8Array(left.length + right_value.length);

    out.set(left, 0);
    out.set(right_value, left.length);

    return ArrayBufferT(out.buffer);
  },
});

Monoid.implement(ArrayBufferT)({
  empty() {
    return ArrayBufferT(new ArrayBuffer(0));
  },
});

Foldable.implement(ArrayBufferT)({
  fold<item, out>(
    this: Value<AsArrayBuffer, item>,
    initial: out,
    fn: (state: out, item: item) => out,
  ) {
    let state = initial;

    for (const byte of new Uint8Array(this.value())) {
      state = fn(state, byte as unknown as item);
    }

    return state;
  },
});

function bytes_equal(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}
