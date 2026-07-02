import { Option, type Option as OptionContext, some } from "../src/option.ts";
import { trait, trait_constructor } from "../src/trait.ts";

// Each benchmark iteration performs this many constructions or read cycles.
const iterations = 10_000;
let sink: unknown;

type BenchValue = OptionContext<number>;

const dictionary = {
  map(this: unknown, fn: (value: number) => number): number {
    return fn(1);
  },
};

const construct_trait = trait_constructor(dictionary);

const proxy_brand = Symbol("proxy.brand");
const proxy_dictionary = Symbol("proxy.dictionary");
const proxy_value = Symbol("proxy.value");

type ProxyTarget<dictionary, value> = {
  readonly [proxy_brand]: true;
  readonly [proxy_dictionary]: dictionary;
  readonly [proxy_value]: value;
};

const record_dictionary = Symbol("record.dictionary");
const record_value = Symbol("record.value");

type RecordValue<dictionary, value> = {
  readonly [record_dictionary]: dictionary;
  readonly [record_value]: value;
};

const prototype_dictionary = Symbol("prototype.dictionary");
const prototype_value = Symbol("prototype.value");

type PrototypeValue<dictionary, value> = {
  readonly [prototype_dictionary]: dictionary;
  readonly [prototype_value]: value;
  value: () => value;
};

type MutablePrototypeValue<dictionary, value> = {
  [prototype_dictionary]: dictionary;
  [prototype_value]: value;
  value: () => value;
};

const prototype = {
  value<dictionary, value>(
    this: PrototypeValue<dictionary, value>,
  ): value {
    return this[prototype_value];
  },
};

Deno.bench("raw option payload construction", () => {
  let current: unknown;

  for (let index = 0; index < iterations; index += 1) {
    current = raw_some(index);
  }

  sink = current;
});

Deno.bench("current some() value construction", () => {
  let current: unknown;

  for (let index = 0; index < iterations; index += 1) {
    current = some(index);
  }

  sink = current;
});

Deno.bench("current Option(raw) value construction", () => {
  let current: unknown;

  for (let index = 0; index < iterations; index += 1) {
    current = Option(raw_some(index));
  }

  sink = current;
});

Deno.bench("current trait(dictionary, raw) construction", () => {
  let current: unknown;

  for (let index = 0; index < iterations; index += 1) {
    current = trait(dictionary, raw_some(index));
  }

  sink = current;
});

Deno.bench("cached trait constructor(raw) construction", () => {
  let current: unknown;

  for (let index = 0; index < iterations; index += 1) {
    current = construct_trait<BenchValue, number>(raw_some(index));
  }

  sink = current;
});

Deno.bench("legacy proxy trait(dictionary, raw) construction", () => {
  let current: unknown;

  for (let index = 0; index < iterations; index += 1) {
    current = proxy_trait(dictionary, raw_some(index));
  }

  sink = current;
});

Deno.bench("tuple [dictionary, raw] construction", () => {
  let current: unknown;

  for (let index = 0; index < iterations; index += 1) {
    current = tuple_value(dictionary, raw_some(index));
  }

  sink = current;
});

Deno.bench("record {dictionary, raw} construction", () => {
  let current: unknown;

  for (let index = 0; index < iterations; index += 1) {
    current = record_value_of(dictionary, raw_some(index));
  }

  sink = current;
});

Deno.bench("prototype symbol object construction", () => {
  let current: unknown;

  for (let index = 0; index < iterations; index += 1) {
    current = prototype_value_of(dictionary, raw_some(index));
  }

  sink = current;
});

Deno.bench("current Option(raw).value() read", () => {
  let current: unknown;

  for (let index = 0; index < iterations; index += 1) {
    current = Option(raw_some(index)).value();
  }

  sink = current;
});

Deno.bench("cached trait constructor(raw).value() read", () => {
  let current: unknown;

  for (let index = 0; index < iterations; index += 1) {
    current = construct_trait<BenchValue, number>(raw_some(index)).value();
  }

  sink = current;
});

Deno.bench("legacy proxy trait(raw).value() read", () => {
  let current: unknown;

  for (let index = 0; index < iterations; index += 1) {
    current = proxy_trait(dictionary, raw_some(index)).value();
  }

  sink = current;
});

Deno.bench("tuple [dictionary, raw][1] read", () => {
  let current: unknown;

  for (let index = 0; index < iterations; index += 1) {
    current = tuple_value(dictionary, raw_some(index))[1];
  }

  sink = current;
});

Deno.bench("prototype symbol object value() read", () => {
  let current: unknown;

  for (let index = 0; index < iterations; index += 1) {
    current = prototype_value_of(dictionary, raw_some(index)).value();
  }

  sink = current;
});

function raw_some(value: number): BenchValue {
  return { tag: "some", value };
}

function proxy_trait<dictionary extends object, value>(
  dictionary: dictionary,
  value: value,
): { value: () => value } & dictionary {
  const target: ProxyTarget<dictionary, value> = {
    [proxy_brand]: true,
    [proxy_dictionary]: dictionary,
    [proxy_value]: value,
  };

  return new Proxy(target, {
    get(current, property, receiver) {
      if (property === proxy_brand) {
        return true;
      }

      if (property === proxy_dictionary) {
        return current[proxy_dictionary];
      }

      if (property === proxy_value) {
        return current[proxy_value];
      }

      if (property === "value") {
        return function value() {
          return current[proxy_value];
        };
      }

      if (property === Symbol.iterator) {
        return function* iterator(): Generator<unknown, unknown, unknown> {
          const item = yield receiver;
          return item;
        };
      }

      const dictionary_value = current[proxy_dictionary][
        property as keyof dictionary
      ];

      if (typeof dictionary_value !== "function") {
        return dictionary_value;
      }

      return function proxy_trait_function(...args: unknown[]) {
        return dictionary_value.call(receiver, ...args);
      };
    },
  }) as unknown as { value: () => value } & dictionary;
}

function tuple_value<dictionary, value>(
  dictionary: dictionary,
  value: value,
): readonly [dictionary, value] {
  return [dictionary, value];
}

function record_value_of<dictionary, value>(
  dictionary: dictionary,
  value: value,
): RecordValue<dictionary, value> {
  return {
    [record_dictionary]: dictionary,
    [record_value]: value,
  };
}

function prototype_value_of<dictionary, value>(
  dictionary: dictionary,
  value: value,
): PrototypeValue<dictionary, value> {
  const current = Object.create(prototype) as MutablePrototypeValue<
    dictionary,
    value
  >;

  current[prototype_dictionary] = dictionary;
  current[prototype_value] = value;

  return current;
}
