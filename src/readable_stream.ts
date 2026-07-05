import { type AsAsyncIterable, AsyncIterableT } from "./async_iterable.ts";
import {
  type As,
  define,
  type type_item,
  type type_value,
  type Value,
} from "./trait.ts";
import { Eq, Show } from "./traits.ts";

export type ReadableStreamT<item> = ReadableStream<item>;

export interface AsReadableStream
  extends As<AsReadableStream>, Show<AsReadableStream>, Eq<AsReadableStream> {
  readonly [type_item]: unknown;
  readonly [type_value]: ReadableStreamT<this[typeof type_item]>;
}

type ReadableStreamValue<item> = Value<AsReadableStream, item>;

export const ReadableStreamT = define<AsReadableStream>();

export function from_readable_stream<item>(
  stream: ReadableStream<item>,
): ReadableStreamValue<item> {
  return ReadableStreamT(stream);
}

export function to_async_iterable<item>(
  stream: ReadableStreamValue<item>,
): Value<AsAsyncIterable, item> {
  const source = stream.value();

  return AsyncIterableT(async function* () {
    const reader = source.getReader();

    try {
      while (true) {
        const next = await reader.read();

        if (next.done === true) {
          return;
        }

        yield next.value;
      }
    } finally {
      reader.releaseLock();
    }
  });
}

Show.implement(ReadableStreamT)({
  show() {
    return "ReadableStream(?)";
  },
});

Eq.implement(ReadableStreamT)({
  eq(right) {
    return Object.is(this.value(), right.value());
  },
});
