export { is_trait } from "./trait_value.ts";
export type { Trait } from "./trait_value.ts";
import {
  trait as raw_as_trait,
  trait_constructor as raw_as_trait_cached,
} from "./trait_value.ts";
import type { Trait } from "./trait_value.ts";

export const kind: unique symbol = Symbol("Trait.kind");
export const item_type: unique symbol = Symbol("Trait.item");
export const value_type: unique symbol = Symbol("Trait.value");

export type This<self> = self | void;

export type ContextValue<dictionary extends Dictionary, item> =
  dictionary extends { readonly [value_type]: unknown }
    ? (dictionary & { readonly [item_type]: item })[typeof value_type]
    : never;

export type Value<dictionary extends Dictionary, item> = Trait<
  dictionary,
  ContextValue<dictionary, item>,
  item
>;

export type Receiver<dictionary extends Dictionary, item> = This<
  Value<dictionary, item>
>;

export type Dictionary<type_id = unknown> = {
  [kind]: type_id;
  readonly [item_type]?: unknown;
};

export function as_trait<dictionary extends Dictionary, item>(
  dictionary: dictionary,
  value: ContextValue<dictionary, item>,
): Value<dictionary, item>;
export function as_trait<dictionary extends object, value, item = unknown>(
  dictionary: dictionary,
  value: value,
): Trait<dictionary, value, item>;
export function as_trait<dictionary extends object, value, item = unknown>(
  dictionary: dictionary,
  value: value,
): Trait<dictionary, value, item> {
  return raw_as_trait(dictionary, value);
}

export function as_trait_cached<dictionary extends Dictionary>(
  dictionary: dictionary,
): <item>(value: ContextValue<dictionary, item>) => Value<dictionary, item>;
export function as_trait_cached<dictionary extends object>(
  dictionary: dictionary,
): <value, item = unknown>(value: value) => Trait<dictionary, value, item>;
export function as_trait_cached<dictionary extends object>(
  dictionary: dictionary,
): <value, item = unknown>(value: value) => Trait<dictionary, value, item> {
  return raw_as_trait_cached(dictionary);
}

export type TraitDictionary<
  dictionary extends Dictionary,
  token extends PropertyKey,
  implementation extends object,
  methods extends object = implementation,
> =
  & Dictionary<dictionary[typeof kind]>
  & { [key in token]: implementation }
  & methods;

export function implement_trait<implementation extends object>(
  dictionary: object,
  token: PropertyKey,
  implementation: implementation,
): implementation {
  Object.assign(dictionary, fluent_trait_methods(implementation));
  (dictionary as { [key: PropertyKey]: unknown })[token] = implementation;

  return implementation;
}

function fluent_trait_methods(implementation: object): object {
  const methods: PropertyDescriptorMap = {};
  const implementation_record = implementation as Record<PropertyKey, unknown>;

  for (const key of Reflect.ownKeys(implementation)) {
    const method = implementation_record[key];

    if (typeof method !== "function") {
      continue;
    }

    methods[key] = {
      configurable: true,
      enumerable: true,
      value: function trait_method(this: unknown, ...args: unknown[]) {
        if (this === undefined || this === null) {
          throw new TypeError("trait method requires a receiver");
        }

        return method(this, ...args);
      },
      writable: true,
    };
  }

  return Object.defineProperties({}, methods);
}

type TraitImplementation<
  token extends PropertyKey,
  dictionary extends { [key in token]: object },
> = dictionary[token];

export type TraitDefinition<token extends PropertyKey = PropertyKey> =
  & TraitDefinitionPrototype<token>
  & {
    readonly token: token;
  };

type TraitDefinitionPrototype<token extends PropertyKey = PropertyKey> = {
  implement<
    dictionary extends Dictionary & { [key in token]: object },
  >(
    this: TraitDefinition<token>,
    dictionary: dictionary,
  ): (
    implementation: TraitImplementation<token, dictionary>,
  ) => TraitImplementation<token, dictionary>;

  implementation<
    receiver extends { [key in token]: object },
  >(
    this: TraitDefinition<token>,
    receiver: receiver,
  ): TraitImplementation<token, receiver>;
};

type TraitMethods<token extends PropertyKey, methods extends object> =
  & methods
  & ThisType<TraitDefinition<token> & methods>;

export function define_trait<token extends PropertyKey, methods extends object>(
  token: token,
  methods: TraitMethods<token, methods>,
): TraitDefinition<token> & methods {
  const definition = Object.assign(
    Object.create(TraitDefinition) as TraitDefinition<token> & methods,
    methods,
  );

  Object.defineProperty(definition, "token", {
    enumerable: true,
    value: token,
  });

  return definition;
}

type TraitDefinitionReceiver<token extends PropertyKey = PropertyKey> = {
  readonly token: token;
};

export const TraitDefinition: TraitDefinitionPrototype = {
  implement<
    token extends PropertyKey,
    dictionary extends Dictionary & { [key in token]: object },
  >(
    this: TraitDefinitionReceiver<token>,
    dictionary: dictionary,
  ): (
    implementation: TraitImplementation<token, dictionary>,
  ) => TraitImplementation<token, dictionary> {
    const token = this.token;

    return (implementation) => {
      return implement_trait(
        dictionary,
        token,
        implementation,
      ) as TraitImplementation<token, dictionary>;
    };
  },

  implementation<
    token extends PropertyKey,
    receiver extends { [key in token]: object },
  >(
    this: TraitDefinitionReceiver<token>,
    receiver: receiver,
  ): TraitImplementation<token, receiver> {
    return receiver[this.token];
  },
};
