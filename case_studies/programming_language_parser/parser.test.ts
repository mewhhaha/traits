import { assert_equals } from "../../src/assert.ts";
import {
  type FunctionDeclaration,
  parse_program,
  type Program,
} from "./language.ts";
import { format_error, type ParseOutcome } from "./parser.ts";

Deno.test("program parser accepts trailing separators in delimited syntax", () => {
  const program = expect_parsed(parse_program(`
type Pair = {
  left: Int,
  right: Int,
};

fn main(left: Int, right: Int,) -> Int {
  let values = [left, right,];
  return add(left, right,);
}
`));
  const main = expect_function(program, "main");

  assert_equals(program.declarations.length, 2);
  assert_equals(main.parameters.length, 2);
});

Deno.test("program parser skips nested block comments", () => {
  const program = expect_parsed(parse_program(`
/* outer
   /* inner */
   still outer
*/
fn main() -> Int {
  return 1;
}
`));

  assert_equals(program.declarations.length, 1);
  assert_equals(expect_function(program, "main").parameters.length, 0);
});

Deno.test("program parser treats keyword prefixes as identifiers", () => {
  const program = expect_parsed(parse_program(`
fn main() -> Int {
  let trueValue = 1;
  return trueValue;
}
`));
  const main = expect_function(program, "main");
  const statement = main.body.statements[0];

  switch (statement.kind) {
    case "let_statement":
      assert_equals(statement.name, "trueValue");
      break;
    case "block_statement":
    case "expression_statement":
    case "if_statement":
    case "return_statement":
    case "while_statement":
      throw new Error("expected let statement");
  }
});

Deno.test("program parser distinguishes record expression statements from blocks", () => {
  const program = expect_parsed(parse_program(`
fn main() -> Int {
  { x: 1, };
  { let y = 2; }
  return 0;
}
`));
  const main = expect_function(program, "main");

  assert_equals(main.body.statements.length, 3);
  assert_equals(main.body.statements[0].kind, "expression_statement");
  assert_equals(main.body.statements[1].kind, "block_statement");
  assert_equals(main.body.statements[2].kind, "return_statement");
});

function expect_parsed(outcome: ParseOutcome<Program>): Program {
  const [tag, payload] = outcome;

  switch (tag) {
    case "parsed":
      return payload;
    case "failed":
      throw new Error(format_error(payload));
  }
}

function expect_function(
  program: Program,
  name: string,
): FunctionDeclaration {
  for (const declaration of program.declarations) {
    switch (declaration.kind) {
      case "function_declaration":
        if (declaration.name === name) {
          return declaration;
        }
        break;
      case "import_declaration":
      case "let_declaration":
      case "type_declaration":
        break;
    }
  }

  throw new Error("missing function: " + name);
}
