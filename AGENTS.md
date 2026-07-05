# AGENTS.md

## Goal

Keep this repository as a small, inspectable library for typeclass-style traits
in TypeScript/Deno.

The core pattern is:

- Define a data type and an `As...` dictionary interface with the same raw value
  shape expressed through `type_item` and `type_value`.
- Export a same-named callable dictionary with `define<As...>()`.
- Attach trait methods directly to the callable dictionary.
- Use tests and examples to make the trait behavior obvious.

## Scope

This repo provides functional programming traits:

- `Functor`: map values inside a context.
- `Applicative`: lift values and apply contextual functions.
- `Monad`: chain context-dependent computations.
- `Foldable`: reduce contextual values into a summary.
- `Format` and `Equal`: small utility traits used by examples and tests.

Prefer simple, inspectable library code. If a change needs advanced type
machinery, add it only when it improves the public API or examples.

## Style

- Keep core trait machinery in `src/trait.ts`.
- Keep application/sublibrary trait definitions in `src/traits.ts`.
- Keep each data type and its trait implementations in one file.
- Keep the `As...` dictionary interface next to the data type and its
  `define<As...>()` export.
- Prefer `switch` statements, then the tagged `match` helper, then explicit `if`
  statements for branching. For tuple-tagged values, typically deconstruct the
  value with `const [tag, payload] = value` and switch on `tag`.
- Do not add external dependencies unless a feature, benchmark, or case study
  needs them.

## Verification

Run:

```sh
deno task check
deno lint
deno test
```
