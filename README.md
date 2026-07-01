# Traits Examples

Small Deno examples for pseudo traits using the same type-plus-empty-function
pattern from `../binned/AGENTS.md`.

The repository demonstrates common functional paradigms without trying to be a
complete functional programming library:

- `Functor` for `map`
- `Applicative` for `pure` and `ap`
- `Monad` for `flat_map`
- `Foldable` for `fold`
- `Format` and `Equal` as small utility traits

## Run

```sh
deno task test
deno task check
deno task example
```

## Shape

Each data type exports a type and a same-named function. That function can wrap
an existing value as `Trait<dictionary, value, item>`, while static helpers and
trait methods stay attached to the same dictionary object. Trait methods use
`this` as their receiver and assert it at runtime, so they can be rebound by the
generic fluent wrapper.

```ts
export type Option<item> =
  | { tag: "some"; value: item }
  | { tag: "none" };

export const option_kind: unique symbol = Symbol("Option");

declare module "./registry.ts" {
  interface Registry<item> {
    [option_kind]: Option<item>;
  }
}

export function Option<item>(
  value: TraitInput<typeof Option, Option<item>, item>,
): Trait<typeof Option, Option<item>, item> {
  return trait<typeof Option, Option<item>, item>(
    Option,
    untrait(value) as Option<item>,
    is_option,
  );
}

Option[kind] = option_kind;

Option.map = impl(function map<from, to>(
  this: Trait<typeof Option, Option<from>, from> | void,
  fn: (value: from) => to,
): Trait<typeof Option, Option<to>, to> {
  const option = require_this(this, "Option.map").value();

  if (option.tag === "none") {
    return Option.none<to>();
  }

  return Option.some(fn(option.value));
});
```

See `src/option.ts`, `src/result.ts`, and `src/list.ts` for complete examples.

## Fluent Experiment

`Option` is also callable as a small branded wrapper around an existing option
value. This keeps the static trait dictionary while experimenting with method
chaining:

```ts
const sum = Option(Option.some((left: number) => {
  return (right: number) => left + right;
}))
  .ap(Option.some(20))
  .ap(Option.some(22));

sum.value(); // Some(42)
sum.eq(Option.some(42)); // true
```

The public trait-wrapped value protocol is `Trait<dictionary, value, item>` from
`src/trait_value.ts`:

```ts
type TraitOption<T> = Trait<typeof Option, Option<T>, T>;
```

The generic `trait(...)` wrapper stores the dictionary internally. `impl(...)`
marks dictionary functions as fluent methods. When a method is read from a
wrapped value, the wrapper looks that method up on `typeof Option` and calls it
with the wrapped option as `this`. Methods that accept contextual values use
`TraitInput<dictionary, value, item>`, and methods that preserve the context
return boxed values directly.

There is no `OptionBox` or `OptionTrait` type. The fluent methods are derived
from the dictionary shape plus the wrapped value and item type.
