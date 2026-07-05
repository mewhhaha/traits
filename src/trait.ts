export { is_trait } from "./trait_value.ts";
export type { Trait } from "./trait_value.ts";
import {
  trait as raw_as_trait,
  trait_constructor as raw_as_trait_cached,
} from "./trait_value.ts";
import type { Trait } from "./trait_value.ts";

export const kind = Symbol("Trait.kind");
const value_type = Symbol("Trait.value_type");

export declare const type_item: unique symbol;
export declare const type_value: unique symbol;

export interface ValueType {
  readonly [type_item]: unknown;
  readonly [type_value]: unknown;
}

export type AppliedValue<type extends ValueType, item> =
  (type & { readonly [type_item]: item })[typeof type_value];

export type ContextValue<dictionary extends Dictionary, item> = AppliedValue<
  DictionaryValueType<dictionary>,
  item
>;

export type DictionaryValueType<dictionary extends Dictionary> =
  NonNullable<dictionary[typeof value_type]> extends ValueType
    ? NonNullable<dictionary[typeof value_type]>
    : ValueType;

export type Value<dictionary extends Dictionary, item> = Trait<
  dictionary,
  ContextValue<dictionary, item>,
  item
>;

export type Dictionary<type extends ValueType = ValueType> = {
  [kind]: unknown;
  readonly [value_type]?: type;
};

export interface As<type extends ValueType> extends Dictionary<type> {
  <item>(value: AppliedValue<type, item>): Trait<
    this,
    AppliedValue<type, item>,
    item
  >;
}

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

export type DictionaryWrapper<dictionary extends Dictionary> = <item>(
  value: ContextValue<dictionary, item>,
) => Value<dictionary, item>;

export type DictionaryConstructorContext<dictionary extends Dictionary> = {
  readonly as_trait: DictionaryWrapper<dictionary>;
};

export type DictionaryConstructor<dictionary extends Dictionary> = <item>(
  this: DictionaryConstructorContext<dictionary>,
  value: ContextValue<dictionary, item>,
) => Value<dictionary, item>;

export function define<dictionary extends Dictionary>(): dictionary;
export function define<dictionary extends Dictionary>(
  construct: DictionaryConstructor<dictionary>,
): dictionary;
export function define<dictionary extends Dictionary>(
  construct?: DictionaryConstructor<dictionary>,
): dictionary {
  const runtime_kind = Symbol("Trait.dictionary") as dictionary[typeof kind];
  const construct_dictionary = construct;

  if (construct_dictionary === undefined) {
    const target = function <item>(
      value: ContextValue<dictionary, item>,
    ): Value<dictionary, item> {
      return as_trait(value);
    } as unknown as dictionary;

    target[kind] = runtime_kind;
    const as_trait = as_trait_cached(target);

    return target;
  }

  const context: DictionaryConstructorContext<dictionary> = {
    as_trait<item>(value: ContextValue<dictionary, item>) {
      return as_trait(value);
    },
  };
  const target = function <item>(
    value: ContextValue<dictionary, item>,
  ): Value<dictionary, item> {
    return construct_dictionary.call(context, value) as Value<dictionary, item>;
  } as unknown as dictionary;

  target[kind] = runtime_kind;
  const as_trait = as_trait_cached(target);

  return target;
}

export type TraitDictionary<
  dictionary extends Dictionary,
  token extends PropertyKey,
  methods extends object,
> =
  & {
    [kind]: dictionary[typeof kind];
    readonly [value_type]?: DictionaryValueType<dictionary>;
  }
  & { [key in token]: methods }
  & methods;

export function call_trait_method<self, args extends unknown[], out>(
  method: (this: self, ...args: args) => out,
  self: self,
  ...args: args
): out {
  return Reflect.apply(method, self, args) as out;
}

export function implement_trait<implementation extends object>(
  dictionary: object,
  token: PropertyKey,
  implementation: implementation,
): implementation {
  Object.assign(dictionary, implementation);
  (dictionary as { [key: PropertyKey]: unknown })[token] = implementation;

  return implementation;
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
