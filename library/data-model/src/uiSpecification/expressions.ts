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

// Recursively compiles an AST node into a closure, collecting referenced
// identifiers. Disallowed node types (member access, calls, arrays, etc.) are
// rejected here at compile time - this is the safety boundary, there is no path
// to property access or invocation.
function compileNode(node: jsep.Expression, refs: Set<string>): NodeEvaluator {
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
      const name = (node as unknown as {name: string}).name;
      refs.add(name);
      return scope => {
        const v = scope.get(name);
        if (v === undefined) {
          throw new ExpressionError(`Unknown field: ${name}`);
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
      const arg = compileNode(n.argument, refs);
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
      const left = compileNode(n.left, refs);
      const right = compileNode(n.right, refs);
      return scope => op(left(scope), right(scope));
    }
    case 'ConditionalExpression': {
      const n = node as unknown as {
        test: jsep.Expression;
        consequent: jsep.Expression;
        alternate: jsep.Expression;
      };
      const test = compileNode(n.test, refs);
      const consequent = compileNode(n.consequent, refs);
      const alternate = compileNode(n.alternate, refs);
      return scope => (test(scope) ? consequent(scope) : alternate(scope));
    }
    default:
      throw new ExpressionError(`Unsupported expression element: ${node.type}`);
  }
}

/**
 * Parses and compiles an arithmetic/conditional expression into a function that
 * evaluates it against a scope of field values. The AST is walked once at
 * compile time to build the evaluator; evaluation is then a plain function call.
 * Throws ExpressionError on malformed or disallowed input. Cached by source.
 */
export const compileComputedExpression = (
  source: string
): CompiledExpression => {
  const cached = cache.get(source);
  if (cached) return cached;

  let ast: jsep.Expression;
  try {
    ast = jsep(source);
  } catch (e) {
    throw new ExpressionError((e as Error).message);
  }

  const refs = new Set<string>();
  const compiledNode = compileNode(ast, refs);

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
