const trait_brand: unique symbol = Symbol("Trait.brand");
const trait_dictionary: unique symbol = Symbol("Trait.dictionary");
const trait_prototype_key: unique symbol = Symbol("Trait.prototype");
const trait_value: unique symbol = Symbol("Trait.value");

type TraitBase<dictionary, value, item> = {
  readonly [trait_brand]: true;
  readonly [trait_dictionary]: dictionary;
  readonly [trait_value]: value;
  [Symbol.iterator]: () => Generator<
    Trait<dictionary, value, item>,
    item,
    item
  >;
  value: () => value;
};

export type Trait<dictionary, value, item = unknown> =
  & TraitBase<dictionary, value, item>
  & dictionary;

type TraitTarget<dictionary, value, item> = {
  [trait_brand]: true;
  [trait_dictionary]: dictionary;
  [trait_value]: value;
};

type TraitDictionary = object & {
  [trait_prototype_key]?: object;
};

export function trait<dictionary extends object, value, item = unknown>(
  dictionary: dictionary,
  value: value,
): Trait<dictionary, value, item> {
  return trait_from_prototype(dictionary, trait_prototype(dictionary), value);
}

export function trait_constructor<dictionary extends object>(
  dictionary: dictionary,
): <value, item = unknown>(value: value) => Trait<dictionary, value, item> {
  const prototype = trait_prototype(dictionary);

  return function construct_trait<value, item = unknown>(
    value: value,
  ): Trait<dictionary, value, item> {
    return trait_from_prototype(dictionary, prototype, value);
  };
}

function trait_from_prototype<dictionary, value, item>(
  dictionary: dictionary,
  prototype: object,
  value: value,
): Trait<dictionary, value, item> {
  const target = Object.create(
    prototype,
  ) as TraitTarget<dictionary, value, item>;

  target[trait_brand] = true;
  target[trait_dictionary] = dictionary;
  target[trait_value] = value;

  return target as unknown as Trait<dictionary, value, item>;
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

function trait_prototype(dictionary: object): object {
  const trait_dictionary = dictionary as TraitDictionary;
  const existing = trait_dictionary[trait_prototype_key];

  if (existing !== undefined) {
    return existing;
  }

  const prototype = Object.create(dictionary);

  Object.defineProperties(prototype, {
    value: {
      value: trait_value_of,
    },
    [Symbol.iterator]: {
      value: trait_iterator,
    },
  });

  Object.defineProperty(trait_dictionary, trait_prototype_key, {
    value: prototype,
  });

  return prototype;
}

function trait_value_of<dictionary, value, item>(
  this: TraitTarget<dictionary, value, item>,
): value {
  return this[trait_value];
}

function* trait_iterator<dictionary, value, item>(
  this: Trait<dictionary, value, item>,
): Generator<Trait<dictionary, value, item>, item, item> {
  const item = yield this;
  return item;
}
