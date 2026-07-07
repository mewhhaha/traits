import ts from "typescript";

const is_generated_identifier = (ts as unknown as {
  isGeneratedIdentifier?: (node: ts.Node) => boolean;
}).isGeneratedIdentifier ?? (() => false);

export type TransformDiagnostic = {
  readonly file_name: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
};

export type TransformResult = {
  readonly code: string;
  readonly diagnostics: readonly TransformDiagnostic[];
  readonly transformed: number;
};

type TransformKind = "do" | "program";

type TransformState = {
  readonly kind: TransformKind;
  readonly factory: ts.NodeFactory;
  readonly source_file: ts.SourceFile;
  readonly diagnostics: TransformDiagnostic[];
};

type TransformBlock = {
  readonly block: ts.Block;
  readonly yielded: boolean;
};

type TransformOptions = {
  readonly continue_expression?: ts.Expression;
};

type YieldStatement =
  | {
    readonly kind: "bind";
    readonly expression: ts.Expression;
    readonly name: ts.BindingName | undefined;
    readonly type: ts.TypeNode | undefined;
  }
  | {
    readonly kind: "return";
    readonly expression: ts.Expression;
  };

class UnsupportedGenerator extends Error {}

export function transform_do_program_source(
  source: string,
  file_name = "input.ts",
): TransformResult {
  const source_file = ts.createSourceFile(
    file_name,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const diagnostics: TransformDiagnostic[] = [];
  const program_scopes = collect_program_scopes(source_file);
  let transformed = 0;
  let needs_program_helpers = false;

  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const factory = context.factory;

    return (source_file) => {
      const visit: ts.Visitor = (node) => {
        if (ts.isVariableStatement(node)) {
          const visited = ts.visitEachChild(node, visit, context);

          if (ts.isVariableStatement(visited)) {
            const inlined = inline_iife_variable_statement(visited, factory);

            if (inlined !== undefined) {
              return inlined;
            }
          }

          return visited;
        }

        if (ts.isReturnStatement(node)) {
          const visited = ts.visitEachChild(node, visit, context);

          if (ts.isReturnStatement(visited)) {
            const inlined = inline_iife_return_statement(visited, factory);

            if (inlined !== undefined) {
              return inlined;
            }
          }

          return visited;
        }

        if (ts.isCallExpression(node)) {
          const kind = transform_kind(node, program_scopes);

          if (kind !== undefined) {
            const transformed_node = transform_call(
              node,
              {
                kind,
                factory,
                source_file,
                diagnostics,
              },
            );

            if (transformed_node !== undefined) {
              transformed += 1;

              if (kind === "program") {
                needs_program_helpers = true;
              }

              return transformed_node;
            }
          }

          const visited = ts.visitEachChild(node, visit, context);

          if (ts.isCallExpression(visited)) {
            const interpreted = transform_interpreter_call(visited, factory);

            if (interpreted !== undefined) {
              transformed += 1;
              return interpreted;
            }

            const handled = transform_handle_with_call(visited, factory);

            if (handled !== undefined) {
              transformed += 1;
              return handled;
            }
          }

          return visited;
        }

        return ts.visitEachChild(node, visit, context);
      };

      const visited = ts.visitEachChild(source_file, visit, context);

      return update_imports(
        visited,
        factory,
        needs_program_helpers,
        diagnostics,
      );
    };
  };

  const result = ts.transform(source_file, [transformer]);
  const output = result.transformed[0];
  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
  });

  try {
    return {
      code: printer.printFile(output),
      diagnostics,
      transformed,
    };
  } finally {
    result.dispose();
  }
}

if (import.meta.main) {
  await run_cli(Deno.args);
}

async function run_cli(args: readonly string[]) {
  const write = args.includes("--write");
  const files = args.filter((arg) => arg !== "--write");

  if (files.length === 0) {
    console.error(
      "usage: deno run --allow-env --allow-read --allow-write tools/transform_do_program.ts [--write] <file...>",
    );
    Deno.exit(2);
  }

  for (const file of files) {
    const source = await Deno.readTextFile(file);
    const result = transform_do_program_source(source, file);

    for (const diagnostic of result.diagnostics) {
      console.error(format_diagnostic(diagnostic));
    }

    if (write) {
      await Deno.writeTextFile(file, result.code);
      continue;
    }

    if (files.length > 1) {
      console.log("// " + file);
    }

    console.log(result.code);
  }
}

function transform_call(
  node: ts.CallExpression,
  state: TransformState,
): ts.Expression | undefined {
  const [run] = node.arguments;

  if (!ts.isFunctionExpression(run)) {
    add_diagnostic(
      state,
      node,
      "Skipped " + state.kind + ": expected a function* argument.",
    );
    return undefined;
  }

  if (run.asteriskToken === undefined) {
    add_diagnostic(
      state,
      node,
      "Skipped " + state.kind + ": expected a function* argument.",
    );
    return undefined;
  }

  try {
    const transformed = transform_statements(
      [...run.body.statements],
      undefined,
      state,
      {},
    );

    if (state.kind === "do" && !transformed.yielded) {
      add_diagnostic(
        state,
        node,
        "Skipped Do: Do requires at least one top-level yield*.",
      );
      return undefined;
    }

    return block_to_expression(transformed.block, state.factory);
  } catch (error) {
    if (error instanceof UnsupportedGenerator) {
      return undefined;
    }

    throw error;
  }
}

function transform_statements(
  statements: readonly ts.Statement[],
  current_context: ts.Expression | undefined,
  state: TransformState,
  options: TransformOptions,
): TransformBlock {
  const prefix: ts.Statement[] = [];

  for (let index = 0; index < statements.length; index += 1) {
    const statement = statements[index];
    const yielded = read_yield_statement(statement);

    if (yielded !== undefined) {
      const rest = statements.slice(index + 1);
      const transformed = transform_yield(yielded, rest, state, options);

      return {
        block: state.factory.createBlock([
          ...prefix,
          ...transformed.block.statements,
        ], true),
        yielded: transformed.yielded,
      };
    }

    if (ts.isReturnStatement(statement)) {
      const expression = statement.expression ?? state.factory.createVoidZero();

      return {
        block: state.factory.createBlock([
          ...prefix,
          state.factory.createReturnStatement(
            create_pure(expression, current_context, state),
          ),
        ], true),
        yielded: current_context !== undefined,
      };
    }

    if (ts.isContinueStatement(statement)) {
      const expression = transform_continue(statement, state, options);

      return {
        block: state.factory.createBlock([
          ...prefix,
          state.factory.createReturnStatement(expression),
        ], true),
        yielded: true,
      };
    }

    if (ts.isIfStatement(statement) && contains_yield_or_return(statement)) {
      const rest = statements.slice(index + 1);
      const transformed = transform_if(
        statement,
        rest,
        current_context,
        state,
        options,
      );

      return {
        block: state.factory.createBlock([
          ...prefix,
          ...transformed.block.statements,
        ], true),
        yielded: transformed.yielded,
      };
    }

    if (
      ts.isSwitchStatement(statement) && contains_yield_or_return(statement)
    ) {
      const rest = statements.slice(index + 1);
      const transformed = transform_switch(
        statement,
        rest,
        current_context,
        state,
        options,
      );

      return {
        block: state.factory.createBlock([
          ...prefix,
          ...transformed.block.statements,
        ], true),
        yielded: transformed.yielded,
      };
    }

    if (ts.isForStatement(statement) && contains_yield_or_return(statement)) {
      const rest = statements.slice(index + 1);
      const transformed = transform_for(
        statement,
        rest,
        current_context,
        state,
        options,
      );

      return {
        block: state.factory.createBlock([
          ...prefix,
          ...transformed.block.statements,
        ], true),
        yielded: transformed.yielded,
      };
    }

    if (contains_yield_or_return(statement)) {
      add_diagnostic(
        state,
        statement,
        "Skipped " + state.kind +
          ": yield* and return are only transformed at the top level of the generator body.",
      );
      throw new UnsupportedGenerator();
    }

    prefix.push(statement);
  }

  return {
    block: state.factory.createBlock([
      ...prefix,
      state.factory.createReturnStatement(
        create_pure(state.factory.createVoidZero(), current_context, state),
      ),
    ], true),
    yielded: current_context !== undefined,
  };
}

function transform_yield(
  yielded: YieldStatement,
  rest: readonly ts.Statement[],
  state: TransformState,
  options: TransformOptions,
): TransformBlock {
  switch (yielded.kind) {
    case "bind": {
      if (state.kind === "do") {
        const context = state.factory.createUniqueName("context");
        const rest_block = transform_statements(rest, context, state, options);
        const direct = create_direct_do_bind(
          yielded.expression,
          context,
          bind_parameters(yielded, state),
          rest_block.block,
          state,
        );

        if (direct !== undefined) {
          return {
            block: state.factory.createBlock([
              state.factory.createReturnStatement(direct),
            ], true),
            yielded: true,
          };
        }

        return {
          block: state.factory.createBlock([
            state.factory.createVariableStatement(
              undefined,
              state.factory.createVariableDeclarationList([
                state.factory.createVariableDeclaration(
                  context,
                  undefined,
                  undefined,
                  yielded.expression,
                ),
              ], ts.NodeFlags.Const),
            ),
            state.factory.createReturnStatement(
              create_bind(
                context,
                bind_parameters(yielded, state),
                rest_block.block,
                state,
              ),
            ),
          ], true),
          yielded: true,
        };
      }

      const rest_block = transform_statements(
        rest,
        yielded.expression,
        state,
        options,
      );

      return {
        block: state.factory.createBlock([
          state.factory.createReturnStatement(
            create_bind(
              yielded.expression,
              bind_parameters(yielded, state),
              rest_block.block,
              state,
            ),
          ),
        ], true),
        yielded: true,
      };
    }

    case "return": {
      if (state.kind === "program") {
        return {
          block: state.factory.createBlock([
            state.factory.createReturnStatement(
              create_effect_from(yielded.expression, state.factory),
            ),
          ], true),
          yielded: true,
        };
      }

      return {
        block: state.factory.createBlock([
          state.factory.createReturnStatement(yielded.expression),
        ], true),
        yielded: true,
      };
    }
  }
}

function transform_continue(
  statement: ts.ContinueStatement,
  state: TransformState,
  options: TransformOptions,
): ts.Expression {
  if (statement.label !== undefined) {
    add_diagnostic(
      state,
      statement,
      "Skipped " + state.kind + ": labeled continues are not supported.",
    );
    throw new UnsupportedGenerator();
  }

  if (options.continue_expression === undefined) {
    add_diagnostic(
      state,
      statement,
      "Skipped " + state.kind +
        ": continue is only supported inside transformed for loops.",
    );
    throw new UnsupportedGenerator();
  }

  return options.continue_expression;
}

function transform_if(
  statement: ts.IfStatement,
  rest: readonly ts.Statement[],
  current_context: ts.Expression | undefined,
  state: TransformState,
  options: TransformOptions,
): TransformBlock {
  const then_block = transform_statements(
    [...unwrap_statement(statement.thenStatement), ...rest],
    current_context,
    state,
    options,
  );
  let yielded = then_block.yielded;

  if (statement.elseStatement !== undefined) {
    const else_block = transform_statements(
      [...unwrap_statement(statement.elseStatement), ...rest],
      current_context,
      state,
      options,
    );
    yielded = yielded || else_block.yielded;

    return {
      block: state.factory.createBlock([
        state.factory.updateIfStatement(
          statement,
          statement.expression,
          then_block.block,
          else_block.block,
        ),
      ], true),
      yielded,
    };
  }

  const continuation = transform_statements(
    rest,
    current_context,
    state,
    options,
  );
  yielded = yielded || continuation.yielded;

  return {
    block: state.factory.createBlock([
      state.factory.updateIfStatement(
        statement,
        statement.expression,
        then_block.block,
        undefined,
      ),
      ...continuation.block.statements,
    ], true),
    yielded,
  };
}

function transform_switch(
  statement: ts.SwitchStatement,
  rest: readonly ts.Statement[],
  current_context: ts.Expression | undefined,
  state: TransformState,
  options: TransformOptions,
): TransformBlock {
  const clauses: ts.CaseOrDefaultClause[] = [];
  let yielded = current_context !== undefined;

  for (const clause of statement.caseBlock.clauses) {
    const normalized = normalize_switch_case(clause, rest, state);
    const transformed = transform_statements(
      normalized,
      current_context,
      state,
      options,
    );
    yielded = yielded || transformed.yielded;
    clauses.push(update_switch_clause(clause, transformed.block, state));
  }

  const continuation = transform_statements(
    rest,
    current_context,
    state,
    options,
  );
  yielded = yielded || continuation.yielded;

  return {
    block: state.factory.createBlock([
      state.factory.updateSwitchStatement(
        statement,
        statement.expression,
        state.factory.updateCaseBlock(statement.caseBlock, clauses),
      ),
      ...continuation.block.statements,
    ], true),
    yielded,
  };
}

function normalize_switch_case(
  clause: ts.CaseOrDefaultClause,
  rest: readonly ts.Statement[],
  state: TransformState,
): readonly ts.Statement[] {
  const statements = unwrap_case_block(clause.statements);

  if (statements.length === 0) {
    add_diagnostic(
      state,
      clause,
      "Skipped " + state.kind + ": switch fallthrough is not supported.",
    );
    throw new UnsupportedGenerator();
  }

  const last = statements[statements.length - 1];

  if (ts.isBreakStatement(last)) {
    if (last.label !== undefined) {
      add_diagnostic(
        state,
        last,
        "Skipped " + state.kind + ": labeled switch breaks are not supported.",
      );
      throw new UnsupportedGenerator();
    }

    return [...statements.slice(0, -1), ...rest];
  }

  if (
    ts.isReturnStatement(last) || ts.isThrowStatement(last) ||
    ts.isContinueStatement(last)
  ) {
    return statements;
  }

  add_diagnostic(
    state,
    last,
    "Skipped " + state.kind + ": switch fallthrough is not supported.",
  );
  throw new UnsupportedGenerator();
}

function transform_for(
  statement: ts.ForStatement,
  rest: readonly ts.Statement[],
  current_context: ts.Expression | undefined,
  state: TransformState,
  options: TransformOptions,
): TransformBlock {
  const loop = read_for_loop(statement, state);
  const loop_name = state.factory.createUniqueName("loop");
  const next_call = state.factory.createCallExpression(
    loop_name,
    undefined,
    [loop.next],
  );
  const body = transform_statements(
    [
      ...unwrap_statement(statement.statement),
      state.factory.createContinueStatement(undefined),
    ],
    current_context,
    state,
    {
      ...options,
      continue_expression: next_call,
    },
  );
  const exit = transform_statements(rest, current_context, state, options);

  return {
    block: state.factory.createBlock([
      state.factory.createFunctionDeclaration(
        undefined,
        undefined,
        loop_name,
        undefined,
        [
          state.factory.createParameterDeclaration(
            undefined,
            undefined,
            loop.variable,
            undefined,
            loop.type,
            undefined,
          ),
        ],
        undefined,
        state.factory.createBlock([
          state.factory.createIfStatement(loop.condition, body.block),
          ...exit.block.statements,
        ], true),
      ),
      state.factory.createReturnStatement(
        state.factory.createCallExpression(loop_name, undefined, [
          loop.initializer,
        ]),
      ),
    ], true),
    yielded: true,
  };
}

type ForLoop = {
  readonly variable: ts.Identifier;
  readonly type: ts.TypeNode | undefined;
  readonly initializer: ts.Expression;
  readonly condition: ts.Expression;
  readonly next: ts.Expression;
};

function read_for_loop(
  statement: ts.ForStatement,
  state: TransformState,
): ForLoop {
  if (statement.initializer === undefined) {
    return unsupported_for_loop(statement, state, "initializer");
  }

  if (!ts.isVariableDeclarationList(statement.initializer)) {
    return unsupported_for_loop(statement, state, "initializer");
  }

  const declarations = statement.initializer.declarations;

  if (declarations.length !== 1) {
    return unsupported_for_loop(statement.initializer, state, "initializer");
  }

  const [declaration] = declarations;

  if (!ts.isIdentifier(declaration.name)) {
    return unsupported_for_loop(declaration, state, "initializer");
  }

  if (declaration.initializer === undefined) {
    return unsupported_for_loop(declaration, state, "initializer");
  }

  if (statement.condition === undefined) {
    return unsupported_for_loop(statement, state, "condition");
  }

  return {
    variable: declaration.name,
    type: declaration.type,
    initializer: declaration.initializer,
    condition: statement.condition,
    next: read_for_loop_next(statement, declaration.name, state),
  };
}

function read_for_loop_next(
  statement: ts.ForStatement,
  variable: ts.Identifier,
  state: TransformState,
): ts.Expression {
  const incrementor = statement.incrementor;

  if (incrementor === undefined) {
    return unsupported_for_loop(statement, state, "incrementor");
  }

  if (ts.isPostfixUnaryExpression(incrementor)) {
    if (!same_identifier(incrementor.operand, variable)) {
      return unsupported_for_loop(incrementor, state, "incrementor");
    }

    switch (incrementor.operator) {
      case ts.SyntaxKind.PlusPlusToken:
        return plus_one(variable, state);
      case ts.SyntaxKind.MinusMinusToken:
        return minus_one(variable, state);
    }
  }

  if (ts.isPrefixUnaryExpression(incrementor)) {
    if (!same_identifier(incrementor.operand, variable)) {
      return unsupported_for_loop(incrementor, state, "incrementor");
    }

    switch (incrementor.operator) {
      case ts.SyntaxKind.PlusPlusToken:
        return plus_one(variable, state);
      case ts.SyntaxKind.MinusMinusToken:
        return minus_one(variable, state);
    }
  }

  if (ts.isBinaryExpression(incrementor)) {
    if (!same_identifier(incrementor.left, variable)) {
      return unsupported_for_loop(incrementor, state, "incrementor");
    }

    switch (incrementor.operatorToken.kind) {
      case ts.SyntaxKind.EqualsToken:
        return incrementor.right;
      case ts.SyntaxKind.PlusEqualsToken:
        return state.factory.createAdd(variable, incrementor.right);
      case ts.SyntaxKind.MinusEqualsToken:
        return state.factory.createSubtract(variable, incrementor.right);
    }
  }

  return unsupported_for_loop(incrementor, state, "incrementor");
}

function unsupported_for_loop<out>(
  node: ts.Node,
  state: TransformState,
  part: string,
): out {
  add_diagnostic(
    state,
    node,
    "Skipped " + state.kind + ": unsupported for-loop " + part + ".",
  );
  throw new UnsupportedGenerator();
}

function plus_one(
  variable: ts.Identifier,
  state: TransformState,
): ts.Expression {
  return state.factory.createAdd(
    variable,
    state.factory.createNumericLiteral(1),
  );
}

function minus_one(
  variable: ts.Identifier,
  state: TransformState,
): ts.Expression {
  return state.factory.createSubtract(
    variable,
    state.factory.createNumericLiteral(1),
  );
}

function same_identifier(left: ts.Node, right: ts.Identifier): boolean {
  return ts.isIdentifier(left) && left.text === right.text;
}

function unwrap_statement(statement: ts.Statement): readonly ts.Statement[] {
  if (ts.isBlock(statement)) {
    return [...statement.statements];
  }

  return [statement];
}

function unwrap_case_block(
  statements: ts.NodeArray<ts.Statement>,
): readonly ts.Statement[] {
  if (statements.length !== 1) {
    return [...statements];
  }

  const [statement] = statements;

  if (!ts.isBlock(statement)) {
    return [statement];
  }

  return [...statement.statements];
}

function update_switch_clause(
  clause: ts.CaseOrDefaultClause,
  block: ts.Block,
  state: TransformState,
): ts.CaseOrDefaultClause {
  const statements: readonly ts.Statement[] = [block];

  if (ts.isCaseClause(clause)) {
    return state.factory.updateCaseClause(
      clause,
      clause.expression,
      statements,
    );
  }

  return state.factory.updateDefaultClause(clause, statements);
}

function bind_parameters(
  yielded: Extract<YieldStatement, { readonly kind: "bind" }>,
  state: TransformState,
): readonly ts.ParameterDeclaration[] {
  if (yielded.name === undefined) {
    return [];
  }

  return [
    state.factory.createParameterDeclaration(
      undefined,
      undefined,
      yielded.name,
      undefined,
      yielded.type,
      undefined,
    ),
  ];
}

function create_bind(
  expression: ts.Expression,
  parameters: readonly ts.ParameterDeclaration[],
  body: ts.Block,
  state: TransformState,
): ts.Expression {
  const factory = state.factory;

  if (state.kind === "do") {
    const mapped = create_final_map(
      expression,
      expression,
      parameters,
      body,
      factory,
    );

    if (mapped !== undefined) {
      return mapped;
    }
  } else {
    const mapped = create_final_effect_map(
      expression,
      parameters,
      body,
      factory,
    );

    if (mapped !== undefined) {
      return mapped;
    }
  }

  const continuation = create_arrow(parameters, body, factory);

  return factory.createCallExpression(
    state.kind === "program"
      ? property(factory, "Effect", "bind_from")
      : factory.createPropertyAccessExpression(expression, "bind"),
    undefined,
    state.kind === "program" ? [expression, continuation] : [continuation],
  );
}

function create_direct_do_bind(
  expression: ts.Expression,
  context: ts.Identifier,
  parameters: readonly ts.ParameterDeclaration[],
  body: ts.Block,
  state: TransformState,
): ts.Expression | undefined {
  const mapped = create_final_map(
    expression,
    context,
    parameters,
    body,
    state.factory,
  );

  if (mapped !== undefined) {
    return mapped;
  }

  if (contains_identifier(body, context)) {
    return undefined;
  }

  return create_bind(expression, parameters, body, state);
}

function create_final_map(
  expression: ts.Expression,
  pure_context: ts.Expression,
  parameters: readonly ts.ParameterDeclaration[],
  body: ts.Block,
  factory: ts.NodeFactory,
): ts.Expression | undefined {
  const statements = [...body.statements];
  const last = statements[statements.length - 1];

  if (last === undefined) {
    return undefined;
  }

  if (!ts.isReturnStatement(last)) {
    return undefined;
  }

  if (statements.slice(0, -1).some(contains_yield_or_return)) {
    return undefined;
  }

  const mapped = read_direct_pure(last.expression, pure_context);

  if (mapped === undefined) {
    return undefined;
  }

  const map_body = factory.createBlock([
    ...statements.slice(0, -1),
    factory.createReturnStatement(mapped),
  ], true);

  return factory.createCallExpression(
    factory.createPropertyAccessExpression(expression, "map"),
    undefined,
    [create_arrow(parameters, map_body, factory)],
  );
}

function create_final_effect_map(
  expression: ts.Expression,
  parameters: readonly ts.ParameterDeclaration[],
  body: ts.Block,
  factory: ts.NodeFactory,
): ts.Expression | undefined {
  const statements = [...body.statements];
  const last = statements[statements.length - 1];

  if (last === undefined) {
    return undefined;
  }

  if (!ts.isReturnStatement(last)) {
    return undefined;
  }

  if (statements.slice(0, -1).some(contains_yield_or_return)) {
    return undefined;
  }

  const mapped = read_effect_pure(last.expression);

  if (mapped === undefined) {
    return undefined;
  }

  const map_body = factory.createBlock([
    ...statements.slice(0, -1),
    factory.createReturnStatement(mapped),
  ], true);

  return factory.createCallExpression(
    property(factory, "Effect", "map_from"),
    undefined,
    [
      expression,
      create_arrow(parameters, map_body, factory),
    ],
  );
}

function read_direct_pure(
  expression: ts.Expression | undefined,
  context: ts.Expression,
): ts.Expression | undefined {
  if (expression === undefined) {
    return undefined;
  }

  if (!ts.isCallExpression(expression)) {
    return undefined;
  }

  if (!ts.isPropertyAccessExpression(expression.expression)) {
    return undefined;
  }

  if (expression.expression.name.text !== "pure") {
    return undefined;
  }

  if (!same_expression(expression.expression.expression, context)) {
    return undefined;
  }

  const [value] = expression.arguments;

  if (value === undefined) {
    return undefined;
  }

  return value;
}

function read_effect_pure(
  expression: ts.Expression | undefined,
): ts.Expression | undefined {
  if (expression === undefined) {
    return undefined;
  }

  if (!ts.isCallExpression(expression)) {
    return undefined;
  }

  if (!ts.isPropertyAccessExpression(expression.expression)) {
    return undefined;
  }

  if (!ts.isIdentifier(expression.expression.expression)) {
    return undefined;
  }

  if (expression.expression.expression.text !== "Effect") {
    return undefined;
  }

  if (expression.expression.name.text !== "pure") {
    return undefined;
  }

  const [value] = expression.arguments;

  if (value === undefined) {
    return undefined;
  }

  return value;
}

function same_expression(left: ts.Expression, right: ts.Expression): boolean {
  if (ts.isIdentifier(left) && ts.isIdentifier(right)) {
    return left.text === right.text;
  }

  return left === right;
}

function contains_identifier(
  node: ts.Node,
  identifier: ts.Identifier,
): boolean {
  let found = false;

  function visit(child: ts.Node) {
    if (found) {
      return;
    }

    if (ts.isIdentifier(child) && child.text === identifier.text) {
      found = true;
      return;
    }

    ts.forEachChild(child, visit);
  }

  ts.forEachChild(node, visit);

  return found;
}

function create_arrow(
  parameters: readonly ts.ParameterDeclaration[],
  body: ts.Block,
  factory: ts.NodeFactory,
): ts.ArrowFunction {
  return factory.createArrowFunction(
    undefined,
    undefined,
    [...parameters],
    undefined,
    undefined,
    body,
  );
}

function create_effect_from(
  expression: ts.Expression,
  factory: ts.NodeFactory,
): ts.Expression {
  return factory.createCallExpression(
    property(factory, "Effect", "from"),
    undefined,
    [expression],
  );
}

function create_pure(
  expression: ts.Expression,
  current_context: ts.Expression | undefined,
  state: TransformState,
): ts.Expression {
  const factory = state.factory;

  if (state.kind === "program") {
    return factory.createCallExpression(
      property(factory, "Effect", "pure"),
      undefined,
      [expression],
    );
  }

  if (current_context === undefined) {
    add_diagnostic(
      state,
      expression,
      "Skipped Do: Do requires a yielded value before returning.",
    );
    throw new UnsupportedGenerator();
  }

  return factory.createCallExpression(
    factory.createPropertyAccessExpression(current_context, "pure"),
    undefined,
    [expression],
  );
}

function read_yield_statement(
  statement: ts.Statement,
): YieldStatement | undefined {
  if (ts.isVariableStatement(statement)) {
    const declarations = statement.declarationList.declarations;

    if (declarations.length !== 1) {
      return undefined;
    }

    const [declaration] = declarations;

    if (!is_yield_star(declaration.initializer)) {
      return undefined;
    }

    return {
      kind: "bind",
      expression: declaration.initializer.expression,
      name: declaration.name,
      type: declaration.type,
    };
  }

  if (
    ts.isExpressionStatement(statement) && is_yield_star(statement.expression)
  ) {
    return {
      kind: "bind",
      expression: statement.expression.expression,
      name: undefined,
      type: undefined,
    };
  }

  if (ts.isReturnStatement(statement) && is_yield_star(statement.expression)) {
    return {
      kind: "return",
      expression: statement.expression.expression,
    };
  }

  return undefined;
}
function is_yield_star(
  expression: ts.Expression | undefined,
): expression is ts.YieldExpression & { readonly expression: ts.Expression } {
  if (expression === undefined) {
    return false;
  }

  if (!ts.isYieldExpression(expression)) {
    return false;
  }

  return expression.asteriskToken !== undefined &&
    expression.expression !== undefined;
}

function block_to_expression(
  block: ts.Block,
  factory: ts.NodeFactory,
): ts.Expression {
  if (block.statements.length === 1) {
    const [statement] = block.statements;

    if (ts.isReturnStatement(statement) && statement.expression !== undefined) {
      return statement.expression;
    }
  }

  return factory.createCallExpression(
    factory.createParenthesizedExpression(
      factory.createArrowFunction(
        undefined,
        undefined,
        [],
        undefined,
        undefined,
        block,
      ),
    ),
    undefined,
    [],
  );
}

function inline_iife_variable_statement(
  statement: ts.VariableStatement,
  factory: ts.NodeFactory,
): readonly ts.Statement[] | undefined {
  const declarations = statement.declarationList.declarations;

  if (declarations.length !== 1) {
    return undefined;
  }

  const [declaration] = declarations;
  const inlined = inline_generated_iife_expression(
    declaration.initializer,
    factory,
  );

  if (inlined === undefined) {
    return inline_iife_variable_statement_with_sequence(statement, factory);
  }

  const { prefix, expression } = inlined;

  if (!prefix.every(is_generated_variable_statement)) {
    return undefined;
  }

  const next_declaration = factory.updateVariableDeclaration(
    declaration,
    declaration.name,
    declaration.exclamationToken,
    declaration.type,
    expression,
  );

  return [
    ...prefix,
    factory.updateVariableStatement(
      statement,
      statement.modifiers,
      factory.updateVariableDeclarationList(
        statement.declarationList,
        [next_declaration],
      ),
    ),
  ];
}

function inline_iife_variable_statement_with_sequence(
  statement: ts.VariableStatement,
  factory: ts.NodeFactory,
): readonly ts.Statement[] | undefined {
  const declarations = statement.declarationList.declarations;

  if (declarations.length !== 1) {
    return undefined;
  }

  const [declaration] = declarations;
  const inlined = sequence_inline_generated_iife_expression(
    declaration.initializer,
    factory,
  );

  if (inlined === undefined) {
    return undefined;
  }

  const next_declaration = factory.updateVariableDeclaration(
    declaration,
    declaration.name,
    declaration.exclamationToken,
    declaration.type,
    inlined.expression,
  );

  return [
    create_generated_let_statement(inlined.declarations, factory),
    factory.updateVariableStatement(
      statement,
      statement.modifiers,
      factory.updateVariableDeclarationList(
        statement.declarationList,
        [next_declaration],
      ),
    ),
  ];
}

function inline_iife_return_statement(
  statement: ts.ReturnStatement,
  factory: ts.NodeFactory,
): readonly ts.Statement[] | undefined {
  const inlined = inline_generated_iife_expression(
    statement.expression,
    factory,
  );

  if (inlined === undefined) {
    return inline_iife_return_statement_with_sequence(statement, factory);
  }

  const { prefix, expression } = inlined;

  if (!prefix.every(is_generated_variable_statement)) {
    return undefined;
  }

  return [
    ...prefix,
    factory.updateReturnStatement(statement, expression),
  ];
}

function inline_iife_return_statement_with_sequence(
  statement: ts.ReturnStatement,
  factory: ts.NodeFactory,
): readonly ts.Statement[] | undefined {
  const inlined = sequence_inline_generated_iife_expression(
    statement.expression,
    factory,
  );

  if (inlined === undefined) {
    return undefined;
  }

  return [
    create_generated_let_statement(inlined.declarations, factory),
    factory.updateReturnStatement(statement, inlined.expression),
  ];
}

type InlinedExpression = {
  readonly prefix: readonly ts.Statement[];
  readonly expression: ts.Expression;
};

type SequencedExpression = {
  readonly declarations: readonly ts.VariableDeclaration[];
  readonly expression: ts.Expression;
};

function inline_generated_iife_expression(
  expression: ts.Expression | undefined,
  factory: ts.NodeFactory,
): InlinedExpression | undefined {
  if (expression === undefined) {
    return undefined;
  }

  const block = read_iife_block(expression);

  if (block !== undefined) {
    return inline_iife_block(block);
  }

  if (ts.isParenthesizedExpression(expression)) {
    const inlined = inline_generated_iife_expression(
      expression.expression,
      factory,
    );

    if (inlined === undefined) {
      return undefined;
    }

    return {
      prefix: inlined.prefix,
      expression: factory.updateParenthesizedExpression(
        expression,
        inlined.expression,
      ),
    };
  }

  if (!ts.isCallExpression(expression)) {
    return undefined;
  }

  if (!is_static_call_target(expression.expression)) {
    return undefined;
  }

  const [first, ...rest] = expression.arguments;

  if (first === undefined || ts.isSpreadElement(first)) {
    return undefined;
  }

  const inlined = inline_generated_iife_expression(first, factory);

  if (inlined === undefined) {
    return undefined;
  }

  return {
    prefix: inlined.prefix,
    expression: factory.updateCallExpression(
      expression,
      expression.expression,
      expression.typeArguments,
      [inlined.expression, ...rest],
    ),
  };
}

function sequence_inline_generated_iife_expression(
  expression: ts.Expression | undefined,
  factory: ts.NodeFactory,
): SequencedExpression | undefined {
  if (expression === undefined) {
    return undefined;
  }

  const block = read_iife_block(expression);

  if (block !== undefined) {
    return sequence_inline_iife_block(block, factory);
  }

  if (ts.isParenthesizedExpression(expression)) {
    const inlined = sequence_inline_generated_iife_expression(
      expression.expression,
      factory,
    );

    if (inlined === undefined) {
      return undefined;
    }

    return {
      declarations: inlined.declarations,
      expression: factory.updateParenthesizedExpression(
        expression,
        inlined.expression,
      ),
    };
  }

  if (ts.isCallExpression(expression)) {
    return sequence_inline_call_arguments(expression, factory);
  }

  return undefined;
}

function sequence_inline_call_arguments(
  expression: ts.CallExpression,
  factory: ts.NodeFactory,
): SequencedExpression | undefined {
  const declarations: ts.VariableDeclaration[] = [];
  const args: ts.Expression[] = [];
  let changed = false;

  for (const argument of expression.arguments) {
    if (ts.isSpreadElement(argument)) {
      return undefined;
    }

    const inlined = sequence_inline_generated_iife_expression(
      argument,
      factory,
    );

    if (inlined === undefined) {
      args.push(argument);
      continue;
    }

    changed = true;
    declarations.push(...inlined.declarations);
    args.push(inlined.expression);
  }

  if (!changed) {
    return undefined;
  }

  return {
    declarations,
    expression: factory.updateCallExpression(
      expression,
      expression.expression,
      expression.typeArguments,
      args,
    ),
  };
}

function sequence_inline_iife_block(
  block: ts.Block,
  factory: ts.NodeFactory,
): SequencedExpression | undefined {
  const inlined = inline_iife_block(block);

  if (inlined === undefined) {
    return undefined;
  }

  if (!inlined.prefix.every(is_generated_variable_statement)) {
    return undefined;
  }

  const declarations: ts.VariableDeclaration[] = [];
  const expressions: ts.Expression[] = [];

  for (const statement of inlined.prefix) {
    if (!ts.isVariableStatement(statement)) {
      return undefined;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) {
        return undefined;
      }

      if (declaration.initializer === undefined) {
        return undefined;
      }

      declarations.push(
        factory.createVariableDeclaration(
          declaration.name,
          undefined,
          declaration.type,
          undefined,
        ),
      );
      expressions.push(
        factory.createAssignment(
          declaration.name,
          declaration.initializer,
        ),
      );
    }
  }

  if (declarations.length === 0) {
    return undefined;
  }

  expressions.push(inlined.expression);

  return {
    declarations,
    expression: factory.createParenthesizedExpression(
      factory.createCommaListExpression(expressions),
    ),
  };
}

function create_generated_let_statement(
  declarations: readonly ts.VariableDeclaration[],
  factory: ts.NodeFactory,
): ts.VariableStatement {
  return factory.createVariableStatement(
    undefined,
    factory.createVariableDeclarationList(
      [...declarations],
      ts.NodeFlags.Let,
    ),
  );
}

function inline_iife_block(block: ts.Block): InlinedExpression | undefined {
  const statements = [...block.statements];
  const last = statements[statements.length - 1];

  if (last === undefined || !ts.isReturnStatement(last)) {
    return undefined;
  }

  if (last.expression === undefined) {
    return undefined;
  }

  return {
    prefix: statements.slice(0, -1),
    expression: last.expression,
  };
}

function is_static_call_target(expression: ts.Expression): boolean {
  if (ts.isIdentifier(expression)) {
    return true;
  }

  if (ts.isPropertyAccessExpression(expression)) {
    return is_static_call_target(expression.expression);
  }

  if (ts.isParenthesizedExpression(expression)) {
    return is_static_call_target(expression.expression);
  }

  return false;
}

function read_iife_block(
  expression: ts.Expression | undefined,
): ts.Block | undefined {
  if (expression === undefined) {
    return undefined;
  }

  if (!ts.isCallExpression(expression)) {
    return undefined;
  }

  if (expression.arguments.length !== 0) {
    return undefined;
  }

  const callee = unwrap_parentheses(expression.expression);

  if (!ts.isArrowFunction(callee)) {
    return undefined;
  }

  if (callee.parameters.length !== 0) {
    return undefined;
  }

  if (!ts.isBlock(callee.body)) {
    return undefined;
  }

  return callee.body;
}

function is_generated_variable_statement(statement: ts.Statement): boolean {
  if (!ts.isVariableStatement(statement)) {
    return false;
  }

  if (statement.modifiers !== undefined && statement.modifiers.length > 0) {
    return false;
  }

  return statement.declarationList.declarations.every((declaration) => {
    return ts.isIdentifier(declaration.name) &&
      is_generated_identifier(declaration.name);
  });
}

function collect_program_scopes(
  source_file: ts.SourceFile,
): ReadonlySet<string> {
  const scopes = new Set<string>(["Program"]);

  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node)) {
      if (
        ts.isIdentifier(node.name) && is_program_scope_call(node.initializer)
      ) {
        scopes.add(node.name.text);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(source_file);

  return scopes;
}

function is_program_scope_call(expression: ts.Expression | undefined): boolean {
  if (expression === undefined) {
    return false;
  }

  if (!ts.isCallExpression(expression)) {
    return false;
  }

  const callee = expression.expression;

  if (!ts.isPropertyAccessExpression(callee)) {
    return false;
  }

  if (!ts.isIdentifier(callee.expression)) {
    return false;
  }

  return callee.expression.text === "Program" && callee.name.text === "scope";
}

function transform_kind(
  node: ts.CallExpression,
  program_scopes: ReadonlySet<string>,
): TransformKind | undefined {
  const callee = node.expression;

  if (!ts.isIdentifier(callee)) {
    return undefined;
  }

  if (callee.text === "Do") {
    return "do";
  }

  if (program_scopes.has(callee.text)) {
    return "program";
  }

  return undefined;
}

function transform_handle_with_call(
  node: ts.CallExpression,
  factory: ts.NodeFactory,
): ts.Expression | undefined {
  if (!is_effect_handle_with(node.expression)) {
    return undefined;
  }

  const effect = node.arguments[0];
  const handlers = node.arguments[1];

  if (effect === undefined || handlers === undefined) {
    return undefined;
  }

  if (!ts.isArrayLiteralExpression(handlers)) {
    return undefined;
  }

  const handler_expressions: ts.Expression[] = [];

  for (const element of handlers.elements) {
    if (ts.isSpreadElement(element)) {
      return undefined;
    }

    if (!is_static_effect_handler(element)) {
      return undefined;
    }

    handler_expressions.push(element);
  }

  let expression: ts.Expression = effect;

  for (const handler of handler_expressions) {
    expression = apply_static_effect_handler(handler, expression, factory);
  }

  return expression;
}

function transform_interpreter_call(
  node: ts.CallExpression,
  factory: ts.NodeFactory,
): ts.Expression | undefined {
  if (!ts.isPropertyAccessExpression(node.expression)) {
    return undefined;
  }

  const effect = read_interpreter_effect(node.expression.expression, factory);

  if (effect === undefined) {
    return undefined;
  }

  switch (node.expression.name.text) {
    case "run": {
      const [runner] = node.arguments;

      if (runner === undefined || node.arguments.length !== 1) {
        return undefined;
      }

      if (!is_static_effect_handler(runner)) {
        return undefined;
      }

      return apply_static_effect_handler(runner, effect, factory);
    }

    case "value":
      if (node.arguments.length !== 0) {
        return undefined;
      }

      return effect;
  }

  return undefined;
}

function read_interpreter_effect(
  expression: ts.Expression,
  factory: ts.NodeFactory,
): ts.Expression | undefined {
  if (!ts.isCallExpression(expression)) {
    return undefined;
  }

  if (is_effect_interpret(expression.expression)) {
    return expression.arguments[0];
  }

  if (!ts.isPropertyAccessExpression(expression.expression)) {
    return undefined;
  }

  if (expression.expression.name.text !== "handle") {
    return undefined;
  }

  const [handler] = expression.arguments;

  if (
    handler === undefined || expression.arguments.length !== 1 ||
    !is_static_effect_handler(handler)
  ) {
    return undefined;
  }

  const effect = read_interpreter_effect(
    expression.expression.expression,
    factory,
  );

  if (effect === undefined) {
    return undefined;
  }

  return apply_static_effect_handler(handler, effect, factory);
}

function is_effect_handle_with(expression: ts.Expression): boolean {
  if (!ts.isPropertyAccessExpression(expression)) {
    return false;
  }

  if (!ts.isIdentifier(expression.expression)) {
    return false;
  }

  return expression.expression.text === "Effect" &&
    expression.name.text === "handle_with";
}

function is_effect_interpret(expression: ts.Expression): boolean {
  if (!ts.isPropertyAccessExpression(expression)) {
    return false;
  }

  if (!ts.isIdentifier(expression.expression)) {
    return false;
  }

  return expression.expression.text === "Effect" &&
    expression.name.text === "interpret";
}

function is_static_effect_handler(expression: ts.Expression): boolean {
  if (ts.isIdentifier(expression)) {
    return true;
  }

  if (ts.isPropertyAccessExpression(expression)) {
    return true;
  }

  if (ts.isArrowFunction(expression)) {
    return true;
  }

  if (ts.isFunctionExpression(expression)) {
    return true;
  }

  if (ts.isParenthesizedExpression(expression)) {
    return is_static_effect_handler(expression.expression);
  }

  return false;
}

function apply_static_effect_handler(
  handler: ts.Expression,
  argument: ts.Expression,
  factory: ts.NodeFactory,
): ts.Expression {
  const unwrapped = unwrap_parentheses(handler);
  const inlined = inline_simple_arrow_handler(unwrapped, argument, factory);

  if (inlined !== undefined) {
    return inlined;
  }

  return factory.createCallExpression(
    call_target(handler, factory),
    undefined,
    [argument],
  );
}

function inline_simple_arrow_handler(
  handler: ts.Expression,
  argument: ts.Expression,
  factory: ts.NodeFactory,
): ts.Expression | undefined {
  if (!ts.isArrowFunction(handler)) {
    return undefined;
  }

  const parameter = handler.parameters[0];

  if (parameter === undefined || handler.parameters.length !== 1) {
    return undefined;
  }

  if (!ts.isIdentifier(parameter.name)) {
    return undefined;
  }

  if (!ts.isCallExpression(handler.body)) {
    return undefined;
  }

  const name = parameter.name.text;
  let replaced = false;
  const args = handler.body.arguments.map((arg) => {
    if (ts.isIdentifier(arg) && arg.text === name) {
      replaced = true;
      return argument;
    }

    return arg;
  });

  if (!replaced) {
    return undefined;
  }

  return factory.updateCallExpression(
    handler.body,
    handler.body.expression,
    handler.body.typeArguments,
    args,
  );
}

function unwrap_parentheses(expression: ts.Expression): ts.Expression {
  let unwrapped = expression;

  while (ts.isParenthesizedExpression(unwrapped)) {
    unwrapped = unwrapped.expression;
  }

  return unwrapped;
}

function call_target(
  expression: ts.Expression,
  factory: ts.NodeFactory,
): ts.Expression {
  if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
    return factory.createParenthesizedExpression(expression);
  }

  return expression;
}

function update_imports(
  source_file: ts.SourceFile,
  factory: ts.NodeFactory,
  needs_program_helpers: boolean,
  diagnostics: TransformDiagnostic[],
): ts.SourceFile {
  let added_program_helpers = !needs_program_helpers;

  const statements = source_file.statements.map((statement) => {
    if (!ts.isImportDeclaration(statement)) {
      return statement;
    }

    if (needs_program_helpers && imports_value(statement, "Program")) {
      added_program_helpers = true;
      return add_import_specifiers(statement, factory, ["Effect"]);
    }

    if (needs_program_helpers && imports_value(statement, "Effect")) {
      added_program_helpers = true;
    }

    return statement;
  });

  if (!added_program_helpers) {
    diagnostics.push({
      file_name: source_file.fileName,
      line: 1,
      column: 1,
      message:
        "Transformed Program but could not find a named Program import to add Effect.",
    });
  }

  return factory.updateSourceFile(source_file, statements);
}

function imports_value(
  declaration: ts.ImportDeclaration,
  name: string,
): boolean {
  const clause = declaration.importClause;

  if (clause === undefined || clause.isTypeOnly) {
    return false;
  }

  const bindings = clause.namedBindings;

  if (bindings === undefined || !ts.isNamedImports(bindings)) {
    return false;
  }

  return bindings.elements.some((element) => {
    if (element.isTypeOnly) {
      return false;
    }

    return element.name.text === name;
  });
}

function add_import_specifiers(
  declaration: ts.ImportDeclaration,
  factory: ts.NodeFactory,
  names: readonly string[],
): ts.ImportDeclaration {
  const clause = declaration.importClause;

  if (clause === undefined) {
    return declaration;
  }

  const bindings = clause.namedBindings;

  if (bindings === undefined || !ts.isNamedImports(bindings)) {
    return declaration;
  }

  const existing = new Set(
    bindings.elements
      .filter((element) => !element.isTypeOnly)
      .map((element) => element.name.text),
  );
  const added = names
    .filter((name) => !existing.has(name))
    .map((name) =>
      factory.createImportSpecifier(
        false,
        undefined,
        factory.createIdentifier(name),
      )
    );

  if (added.length === 0) {
    return declaration;
  }

  return factory.updateImportDeclaration(
    declaration,
    declaration.modifiers,
    factory.updateImportClause(
      clause,
      clause.isTypeOnly,
      clause.name,
      factory.updateNamedImports(bindings, [...bindings.elements, ...added]),
    ),
    declaration.moduleSpecifier,
    declaration.attributes,
  );
}

function contains_yield_or_return(node: ts.Node): boolean {
  let found = false;

  function visit(node: ts.Node) {
    if (found) {
      return;
    }

    if (ts.isFunctionLike(node) && node.parent !== undefined) {
      return;
    }

    if (ts.isYieldExpression(node) || ts.isReturnStatement(node)) {
      found = true;
      return;
    }

    ts.forEachChild(node, visit);
  }

  ts.forEachChild(node, visit);

  return found;
}

function property(
  factory: ts.NodeFactory,
  object: string,
  name: string,
): ts.PropertyAccessExpression {
  return factory.createPropertyAccessExpression(
    factory.createIdentifier(object),
    name,
  );
}

function add_diagnostic(
  state: TransformState,
  node: ts.Node,
  message: string,
) {
  const position = state.source_file.getLineAndCharacterOfPosition(
    node.getStart(state.source_file),
  );

  state.diagnostics.push({
    file_name: state.source_file.fileName,
    line: position.line + 1,
    column: position.character + 1,
    message,
  });
}

function format_diagnostic(diagnostic: TransformDiagnostic): string {
  return diagnostic.file_name + ":" + diagnostic.line.toString() + ":" +
    diagnostic.column.toString() + ": " + diagnostic.message;
}
