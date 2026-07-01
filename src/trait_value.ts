const trait_brand: unique symbol = Symbol("Trait.brand");
const trait_dictionary: unique symbol = Symbol("Trait.dictionary");
const trait_item: unique symbol = Symbol("Trait.item");
const trait_value: unique symbol = Symbol("Trait.value");

export type TraitInput<dictionary, value, item = unknown> =
  | value
  | Trait<dictionary, value, item>;

const trait_impl: unique symbol = Symbol("Trait.impl");

export type TraitImpl<fn> = fn & {
  readonly [trait_impl]: true;
};

export function impl<fn extends (this: any, ...args: any[]) => any>(
  fn: fn,
): TraitImpl<fn> {
  Object.defineProperty(fn, trait_impl, { value: true });
  return fn as TraitImpl<fn>;
}

type TraitBase<dictionary, value, item> = {
  readonly [trait_brand]: true;
  readonly [trait_dictionary]: dictionary;
  readonly [trait_item]: item;
  readonly [trait_value]: value;
  value: () => value;
};

type BoundDictionary<dictionary> = {
  [
    key in keyof dictionary as dictionary[key] extends {
      readonly [trait_impl]: true;
    } ? key
      : never
  ]: dictionary[key];
};

export type Trait<dictionary, value, item = unknown> =
  & TraitBase<dictionary, value, item>
  & BoundDictionary<dictionary>;

type TraitTarget<dictionary, value, item> = {
  readonly [trait_brand]: true;
  readonly [trait_dictionary]: dictionary;
  readonly [trait_item]: item;
  readonly [trait_value]: value;
};

export function trait<dictionary extends object, value, item = unknown>(
  dictionary: dictionary,
  value: value,
  is_value: (value: unknown) => value is value,
): Trait<dictionary, value, item> {
  const target: TraitTarget<dictionary, value, item> = {
    [trait_brand]: true,
    [trait_dictionary]: dictionary,
    [trait_item]: undefined as item,
    [trait_value]: value,
  };

  return new Proxy(target, {
    get(current, property, receiver) {
      if (property === trait_brand) {
        return true;
      }

      if (property === trait_dictionary) {
        return current[trait_dictionary];
      }

      if (property === trait_item) {
        return current[trait_item];
      }

      if (property === trait_value) {
        return current[trait_value];
      }

      if (property === "value") {
        return function value() {
          return current[trait_value];
        };
      }

      const dictionary_value = current[trait_dictionary][
        property as keyof dictionary
      ];

      if (!is_trait_impl(dictionary_value)) {
        return dictionary_value;
      }

      return function trait_impl(...args: unknown[]) {
        const result = dictionary_value.call(
          receiver,
          ...args,
        );

        if (is_trait(result)) {
          return result;
        }

        if (is_value(result)) {
          return trait(current[trait_dictionary], result, is_value);
        }

        return result;
      };
    },
  }) as unknown as Trait<dictionary, value, item>;
}

function is_trait_impl(value: unknown): value is TraitImpl<
  (this: any, ...args: any[]) => any
> {
  if (typeof value !== "function") {
    return false;
  }

  return (value as { [trait_impl]?: unknown })[trait_impl] === true;
}

export function is_trait(
  value: unknown,
): value is Trait<object, unknown, unknown> {
  if (typeof value !== "object") {
    return false;
  }

  if (value === null) {
    return false;
  }

  const candidate = value as { [trait_brand]?: unknown };
  return candidate[trait_brand] === true;
}

export function untrait(value: unknown): unknown {
  if (is_trait(value)) {
    return value.value();
  }

  return value;
}
