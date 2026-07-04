import {
  attempt,
  between,
  char,
  chunk,
  left,
  many,
  nested_delimited,
  not_followed_by,
  type ParserValue,
  right,
  satisfy,
  take_while,
} from "./parser.ts";

const space_consumer: ParserValue<void> = many(hidden_piece()).map(() => {
  return undefined;
});

export function skip_hidden(): ParserValue<void> {
  return space_consumer;
}

export function lexeme<item>(parser: ParserValue<item>): ParserValue<item> {
  return left(parser, skip_hidden());
}

export function keyword(word: string): ParserValue<string> {
  return lexeme(
    attempt(
      left(
        chunk(word),
        not_followed_by(
          satisfy("identifier character", is_identifier_continue),
          "keyword boundary",
        ),
      ),
    ),
  );
}

export function symbol(text: string): ParserValue<string> {
  return lexeme(chunk(text));
}

export function comma(): ParserValue<string> {
  return symbol(",");
}

export function parens<item>(parser: ParserValue<item>): ParserValue<item> {
  return between(symbol("("), parser, symbol(")"));
}

export function braces<item>(parser: ParserValue<item>): ParserValue<item> {
  return between(symbol("{"), parser, symbol("}"));
}

export function brackets<item>(parser: ParserValue<item>): ParserValue<item> {
  return between(symbol("["), parser, symbol("]"));
}

export function angles<item>(parser: ParserValue<item>): ParserValue<item> {
  return between(symbol("<"), parser, symbol(">"));
}

export function quoted_string_body<item>(
  parser: ParserValue<item>,
): ParserValue<item> {
  return between(char('"'), parser, char('"'));
}

export function is_identifier_start(value: string): boolean {
  if (value === "_") {
    return true;
  }

  return is_alpha(value);
}

export function is_identifier_continue(value: string): boolean {
  if (is_identifier_start(value)) {
    return true;
  }

  return is_digit(value);
}

export function is_digit(value: string): boolean {
  return value >= "0" && value <= "9";
}

function hidden_piece(): ParserValue<void> {
  return attempt(white_space())
    .alt(attempt(line_comment()))
    .alt(block_comment());
}

function white_space(): ParserValue<void> {
  return take_while("white space", is_space, 1).map(() => {
    return undefined;
  });
}

function line_comment(): ParserValue<void> {
  return right(
    chunk("//"),
    take_while("line comment", (value) => {
      return value !== "\n";
    }),
  ).map(() => {
    return undefined;
  });
}

function block_comment(): ParserValue<void> {
  return nested_delimited("/*", "*/", "block comment");
}

function is_alpha(value: string): boolean {
  if (value >= "a" && value <= "z") {
    return true;
  }

  if (value >= "A" && value <= "Z") {
    return true;
  }

  return false;
}

function is_space(value: string): boolean {
  if (value === " ") {
    return true;
  }

  if (value === "\n") {
    return true;
  }

  if (value === "\r") {
    return true;
  }

  if (value === "\t") {
    return true;
  }

  return false;
}
