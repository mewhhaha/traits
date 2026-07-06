import { is_data, type WrappedData } from "./typeclass.ts";

export type TaggedValue = readonly [PropertyKey, ...readonly unknown[]];
export type MatchValue =
  | TaggedValue
  | WrappedData<object, TaggedValue, unknown>;

type TaggedOf<value extends MatchValue> = value extends WrappedData<
  object,
  infer tagged,
  unknown
> ? tagged extends TaggedValue ? tagged : never
  : value;

export type TagOf<value extends MatchValue> = TaggedOf<value>[0];

type VariantOf<
  value extends MatchValue,
  tag extends TagOf<value>,
> = Extract<TaggedOf<value>, readonly [tag, ...readonly unknown[]]>;

type PayloadOf<value extends TaggedValue> = value extends readonly [
  PropertyKey,
  ...infer payload,
] ? payload
  : never;

export type MatchCases<value extends MatchValue, out> = {
  readonly [tag in TagOf<value>]: (
    ...payload: PayloadOf<VariantOf<value, tag>>
  ) => out;
};

export function match<value extends MatchValue, out>(
  value: value,
  cases: MatchCases<value, out>,
): out {
  const tagged = (is_data(value) ? value.value() : value) as TaggedValue;
  const tag = tagged[0] as TagOf<value>;
  const payload = tagged.slice(1) as unknown[];
  const handler = cases[tag] as (...payload: unknown[]) => out;

  return handler(...payload);
}
