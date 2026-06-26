/*
 * Copyright 2024 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: expressions.ts
 * Description:
 *   Compiles arithmetic/conditional expressions used by ComputedField into a
 *   callable evaluator, mirroring how conditionals.ts compiles conditions. An
 *   expression is parsed once and compiled into a closure; evaluation is then a
 *   plain function call with no re-parsing or per-node type dispatch.
 *
 *   Field references are written in braces, e.g. {Width} * {Height}. The braces
 *   delimit the exact field ID, so an ID containing characters that would
 *   otherwise be operators (e.g. the hyphens in {Wet-Soil-Mass-g}) is treated
 *   as a single reference rather than parsed as arithmetic.
 */

import jsep from 'jsep';
import ternary from '@jsep-plugin/ternary';

// Enable the ternary operator (x ? y : z). Comparison and logical operators
// (==, <, >, &&, ||) are built into jsep already.
jsep.plugins.register(ternary);

/** Thrown when an expression is malformed or contains a disallowed element. */
export class ExpressionError extends Error {}

/** A parsed, validated expression ready to evaluate. */
export interface CompiledExpression {
  /** Field IDs referenced by the expression. */
  references: string[];
  /**
   * Evaluates against a scope of field ID -> numeric value. Returns null when
   * the result is not a finite number or evaluation fails.
   */
  evaluate: (scope: Map<string, number>) => number | null;
}

// A node compiled into a closure over the scope. Compilation does the type and
// operator dispatch once; evaluation is just a function call.
type NodeEvaluator = (scope: Map<string, number>) => number;

// Prefix for the safe placeholder identifiers that stand in for braced field
// references while jsep parses. Chosen to not collide with a real expression.
const PLACEHOLDER_PREFIX = '__faimsRef';

const cache = new Map<string, CompiledExpression>();

// Binary operator implementations. Comparisons and logical operators return
// 1/0 so they compose with arithmetic. Selected once at compile time.
const binaryOps: {[op: string]: (l: number, r: number) => number} = {
  '+': (l, r) => l + r,
  '-': (l, r) => l - r,
  '*': (l, r) => l * r,
  '/': (l, r) => l / r,
  '%': (l, r) => l % r,
  '==': (l, r) => (l === r ? 1 : 0),
  '!=': (l, r) => (l !== r ? 1 : 0),
  '<': (l, r) => (l < r ? 1 : 0),
  '>': (l, r) => (l > r ? 1 : 0),
  '<=': (l, r) => (l <= r ? 1 : 0),
  '>=': (l, r) => (l >= r ? 1 : 0),
  '&&': (l, r) => (l && r ? 1 : 0),
  '||': (l, r) => (l || r ? 1 : 0),
};

const unaryOps: {[op: string]: (v: number) => number} = {
  '-': v => -v,
  '+': v => v,
  '!': v => (v ? 0 : 1),
};

// Replaces each {field id} span with a safe placeholder identifier so jsep can
// parse the surrounding arithmetic without the field id's own characters (e.g.
// hyphens) being read as operators. Returns the rewritten source and a map from
// placeholder back to the real field id. Throws on malformed braces.
function substituteReferences(source: string): {
  processed: string;
  placeholders: Map<string, string>;
} {
  const placeholders = new Map<string, string>();
  let counter = 0;
  let out = '';
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '{') {
      const close = source.indexOf('}', i + 1);
      if (close === -1) {
        throw new ExpressionError('Unbalanced braces in expression');
      }
      const inner = source.slice(i + 1, close);
      if (inner.length === 0) {
        throw new ExpressionError('Empty field reference {}');
      }
      if (inner.includes('{')) {
        throw new ExpressionError('Nested braces are not allowed');
      }
      const placeholder = `${PLACEHOLDER_PREFIX}${counter++}`;
      placeholders.set(placeholder, inner);
      out += placeholder;
      i = close + 1;
    } else if (ch === '}') {
      throw new ExpressionError('Unbalanced braces in expression');
    } else {
      out += ch;
      i++;
    }
  }
  return {processed: out, placeholders};
}

// Recursively compiles an AST node into a closure, collecting referenced field
// ids. Identifiers must be placeholders produced by substituteReferences (i.e.
// braced references in the source); a bare identifier means an unbraced field
// name, which is rejected. Disallowed node types (member access, calls, etc.)
// are rejected here at compile time - the safety boundary, with no path to
// property access or invocation.
function compileNode(
  node: jsep.Expression,
  refs: Set<string>,
  placeholders: Map<string, string>
): NodeEvaluator {
  switch (node.type) {
    case 'Literal': {
      const v = (node as unknown as {value: unknown}).value;
      if (typeof v === 'number') {
        const num = v;
        return () => num;
      }
      if (typeof v === 'boolean') {
        const num = v ? 1 : 0;
        return () => num;
      }
      throw new ExpressionError(
        'Only numeric and boolean literals are allowed'
      );
    }
    case 'Identifier': {
      const raw = (node as unknown as {name: string}).name;
      const fieldId = placeholders.get(raw);
      if (fieldId === undefined) {
        // A bare identifier that is not a placeholder means an unbraced field
        // reference; field references must be wrapped in braces, e.g. {name}.
        throw new ExpressionError(
          `Field references must be wrapped in braces, e.g. {${raw}}`
        );
      }
      refs.add(fieldId);
      return scope => {
        const v = scope.get(fieldId);
        if (v === undefined) {
          throw new ExpressionError(`Unknown field: ${fieldId}`);
        }
        return v;
      };
    }
    case 'UnaryExpression': {
      const n = node as unknown as {
        operator: string;
        argument: jsep.Expression;
      };
      const op = unaryOps[n.operator];
      if (!op) {
        throw new ExpressionError(`Unsupported unary operator: ${n.operator}`);
      }
      const arg = compileNode(n.argument, refs, placeholders);
      return scope => op(arg(scope));
    }
    case 'BinaryExpression': {
      const n = node as unknown as {
        operator: string;
        left: jsep.Expression;
        right: jsep.Expression;
      };
      const op = binaryOps[n.operator];
      if (!op) {
        throw new ExpressionError(`Unsupported operator: ${n.operator}`);
      }
      const left = compileNode(n.left, refs, placeholders);
      const right = compileNode(n.right, refs, placeholders);
      return scope => op(left(scope), right(scope));
    }
    case 'ConditionalExpression': {
      const n = node as unknown as {
        test: jsep.Expression;
        consequent: jsep.Expression;
        alternate: jsep.Expression;
      };
      const test = compileNode(n.test, refs, placeholders);
      const consequent = compileNode(n.consequent, refs, placeholders);
      const alternate = compileNode(n.alternate, refs, placeholders);
      return scope => (test(scope) ? consequent(scope) : alternate(scope));
    }
    default:
      throw new ExpressionError(`Unsupported expression element: ${node.type}`);
  }
}

/**
 * Parses and compiles an arithmetic/conditional expression into a function that
 * evaluates it against a scope of field values. Field references are written in
 * braces ({Field ID}); the AST is walked once at compile time to build the
 * evaluator, so evaluation is a plain function call. Throws ExpressionError on
 * malformed or disallowed input. Cached by source.
 */
export const compileComputedExpression = (
  source: string
): CompiledExpression => {
  const cached = cache.get(source);
  if (cached) return cached;

  const {processed, placeholders} = substituteReferences(source);

  let ast: jsep.Expression;
  try {
    ast = jsep(processed);
  } catch (e) {
    throw new ExpressionError((e as Error).message);
  }

  const refs = new Set<string>();
  const compiledNode = compileNode(ast, refs, placeholders);

  const evaluate = (scope: Map<string, number>): number | null => {
    try {
      const result = compiledNode(scope);
      return Number.isFinite(result) ? result : null;
    } catch {
      return null;
    }
  };

  const compiled: CompiledExpression = {references: [...refs], evaluate};
  cache.set(source, compiled);
  return compiled;
};
