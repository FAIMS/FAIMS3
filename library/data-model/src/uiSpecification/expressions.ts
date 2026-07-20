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
 *   Compiles typed arithmetic/string/boolean expressions used by the computed
 *   fields (ComputedNumber, ComputedText) into a callable evaluator, mirroring
 *   how conditionals.ts compiles conditions. An expression is parsed and type
 *   checked once at notebook load; evaluation is then a plain function call.
 *
 *   Field references are written in braces, e.g. {Width} * {Height}. The braces
 *   delimit the exact field ID, so an ID containing characters that would
 *   otherwise be operators (e.g. the hyphens in {Wet-Soil-Mass-g}) is treated
 *   as a single reference rather than parsed as arithmetic.
 *
 *   Typing is strict - there is no implicit coercion, and mismatches are
 *   rejected at compile time so the designer can surface them:
 *   - + - * / %   numbers only
 *   - &           string concatenation only
 *   - && || !     booleans only
 *   - < > <= >=   two numbers or two strings
 *   - == !=       matching types only
 *   - a ? b : c   condition must be boolean; both branches the same type
 */

import jsep from 'jsep';
import ternary from '@jsep-plugin/ternary';

// Enable the ternary operator (x ? y : z). Comparison, logical and the '&'
// operator (used here for concatenation) are built into jsep already.
jsep.plugins.register(ternary);

/** Thrown when an expression is malformed, ill-typed, or disallowed. */
export class ExpressionError extends Error {}

/** The value types an expression can produce or consume. */
export type ExprType = 'number' | 'string' | 'boolean';

/** A runtime expression value. */
export type ExprValue = number | string | boolean;

/**
 * Maps a field's declared type-returned onto an expression value type. Fields
 * whose type is not listed are not referenceable from expressions.
 */
export const FAIMS_TYPE_TO_EXPR_TYPE: {[faimsType: string]: ExprType} = {
  'faims-core::Number': 'number',
  'faims-core::Integer': 'number',
  'faims-core::String': 'string',
  'faims-core::Bool': 'boolean',
};

/** A parsed, type checked expression ready to evaluate. */
export interface CompiledExpression {
  /** Field IDs referenced by the expression. */
  references: string[];
  /** The type the expression produces. */
  returnType: ExprType;
  /**
   * Evaluates against a scope of field ID -> value. Returns null when a
   * referenced value is missing, evaluation fails, or a numeric result is not
   * finite.
   */
  evaluate: (scope: Map<string, ExprValue>) => ExprValue | null;
}

// A node compiled into a closure plus its inferred type. Type checking and
// operator dispatch happen once at compile time; evaluation is a function call.
type CompiledNode = {
  type: ExprType;
  ev: (scope: Map<string, ExprValue>) => ExprValue;
};

// Prefix for the safe placeholder identifiers that stand in for braced field
// references while jsep parses. Chosen to not collide with a real expression.
const PLACEHOLDER_PREFIX = '__faimsRef';

// Operator implementations, grouped by the types they accept. Selection and
// type checking happen at compile time.
const arithOps: {[op: string]: (l: number, r: number) => number} = {
  '+': (l, r) => l + r,
  '-': (l, r) => l - r,
  '*': (l, r) => l * r,
  '/': (l, r) => l / r,
  '%': (l, r) => l % r,
};
const boolOps: {[op: string]: (l: boolean, r: boolean) => boolean} = {
  '&&': (l, r) => l && r,
  '||': (l, r) => l || r,
};
const orderOps: {
  [op: string]: (l: number | string, r: number | string) => boolean;
} = {
  '<': (l, r) => l < r,
  '>': (l, r) => l > r,
  '<=': (l, r) => l <= r,
  '>=': (l, r) => l >= r,
};
const eqOps: {[op: string]: (l: ExprValue, r: ExprValue) => boolean} = {
  '==': (l, r) => l === r,
  '!=': (l, r) => l !== r,
};

// Replaces each {field id} span with a safe placeholder identifier so jsep can
// parse the surrounding expression without the field id's own characters (e.g.
// hyphens) being read as operators. Throws on malformed braces.
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

// Recursively compiles an AST node into a typed closure, collecting referenced
// field ids and type checking as it goes. Disallowed node types (member access,
// calls, arrays, etc.) are rejected here - the safety boundary, with no path to
// property access or invocation. Note jsep emits && and || as
// LogicalExpression, not BinaryExpression.
function compileNode(
  node: jsep.Expression,
  refs: Set<string>,
  placeholders: Map<string, string>,
  fieldTypes: Map<string, ExprType>
): CompiledNode {
  switch (node.type) {
    case 'Literal': {
      const v = (node as unknown as {value: unknown}).value;
      if (typeof v === 'number') {
        const num = v;
        return {type: 'number', ev: () => num};
      }
      if (typeof v === 'string') {
        const str = v;
        return {type: 'string', ev: () => str};
      }
      if (typeof v === 'boolean') {
        const b = v;
        return {type: 'boolean', ev: () => b};
      }
      throw new ExpressionError('Unsupported literal type');
    }
    case 'Identifier': {
      const raw = (node as unknown as {name: string}).name;
      const fieldId = placeholders.get(raw);
      if (fieldId === undefined) {
        throw new ExpressionError(
          `Field references must be wrapped in braces, e.g. {${raw}}`
        );
      }
      const fieldType = fieldTypes.get(fieldId);
      if (fieldType === undefined) {
        throw new ExpressionError(`Unknown field: ${fieldId}`);
      }
      refs.add(fieldId);
      return {
        type: fieldType,
        ev: scope => {
          const v = scope.get(fieldId);
          if (v === undefined) {
            throw new ExpressionError(`Missing value for field: ${fieldId}`);
          }
          return v;
        },
      };
    }
    case 'UnaryExpression': {
      const n = node as unknown as {
        operator: string;
        argument: jsep.Expression;
      };
      const arg = compileNode(n.argument, refs, placeholders, fieldTypes);
      if (n.operator === '-' || n.operator === '+') {
        if (arg.type !== 'number') {
          throw new ExpressionError(
            `Unary ${n.operator} requires a number, got ${arg.type}`
          );
        }
        const negate = n.operator === '-';
        return {
          type: 'number',
          ev: s => (negate ? -(arg.ev(s) as number) : (arg.ev(s) as number)),
        };
      }
      if (n.operator === '!') {
        if (arg.type !== 'boolean') {
          throw new ExpressionError(`! requires a boolean, got ${arg.type}`);
        }
        return {type: 'boolean', ev: s => !(arg.ev(s) as boolean)};
      }
      throw new ExpressionError(`Unsupported unary operator: ${n.operator}`);
    }
    // jsep emits && / || as LogicalExpression; everything else binary comes
    // through as BinaryExpression. Both are handled with the same type rules.
    case 'BinaryExpression':
    case 'LogicalExpression': {
      const n = node as unknown as {
        operator: string;
        left: jsep.Expression;
        right: jsep.Expression;
      };
      const op = n.operator;
      const left = compileNode(n.left, refs, placeholders, fieldTypes);
      const right = compileNode(n.right, refs, placeholders, fieldTypes);

      if (op in arithOps) {
        if (left.type !== 'number' || right.type !== 'number') {
          throw new ExpressionError(
            `${op} requires numbers, got ${left.type} and ${right.type}`
          );
        }
        const f = arithOps[op];
        return {
          type: 'number',
          ev: s => f(left.ev(s) as number, right.ev(s) as number),
        };
      }
      if (op === '&') {
        if (left.type !== 'string' || right.type !== 'string') {
          throw new ExpressionError(
            `& (concatenation) requires strings, got ${left.type} and ${right.type}`
          );
        }
        return {
          type: 'string',
          ev: s => (left.ev(s) as string) + (right.ev(s) as string),
        };
      }
      if (op in boolOps) {
        if (left.type !== 'boolean' || right.type !== 'boolean') {
          throw new ExpressionError(
            `${op} requires booleans, got ${left.type} and ${right.type}`
          );
        }
        const f = boolOps[op];
        return {
          type: 'boolean',
          ev: s => f(left.ev(s) as boolean, right.ev(s) as boolean),
        };
      }
      if (op in orderOps) {
        const bothNumbers = left.type === 'number' && right.type === 'number';
        const bothStrings = left.type === 'string' && right.type === 'string';
        if (!bothNumbers && !bothStrings) {
          throw new ExpressionError(
            `${op} requires two numbers or two strings, got ${left.type} and ${right.type}`
          );
        }
        const f = orderOps[op];
        return {
          type: 'boolean',
          ev: s =>
            f(left.ev(s) as number | string, right.ev(s) as number | string),
        };
      }
      if (op in eqOps) {
        if (left.type !== right.type) {
          throw new ExpressionError(
            `${op} requires matching types, got ${left.type} and ${right.type}`
          );
        }
        const f = eqOps[op];
        return {type: 'boolean', ev: s => f(left.ev(s), right.ev(s))};
      }
      throw new ExpressionError(`Unsupported operator: ${op}`);
    }
    case 'ConditionalExpression': {
      const n = node as unknown as {
        test: jsep.Expression;
        consequent: jsep.Expression;
        alternate: jsep.Expression;
      };
      const test = compileNode(n.test, refs, placeholders, fieldTypes);
      if (test.type !== 'boolean') {
        throw new ExpressionError(
          `Ternary condition must be boolean, got ${test.type}`
        );
      }
      const consequent = compileNode(
        n.consequent,
        refs,
        placeholders,
        fieldTypes
      );
      const alternate = compileNode(
        n.alternate,
        refs,
        placeholders,
        fieldTypes
      );
      if (consequent.type !== alternate.type) {
        throw new ExpressionError(
          `Ternary branches must have the same type, got ${consequent.type} and ${alternate.type}`
        );
      }
      return {
        type: consequent.type,
        ev: s => (test.ev(s) ? consequent.ev(s) : alternate.ev(s)),
      };
    }
    default:
      throw new ExpressionError(`Unsupported expression element: ${node.type}`);
  }
}

/**
 * Parses and compiles a typed expression into a function that evaluates it
 * against a scope of field values. Field references are written in braces
 * ({Field ID}) and their types are supplied via fieldTypes; the expression is
 * type checked bottom-up at compile time with no implicit coercion. If
 * requiredType is given, the expression's type must match it. Throws
 * ExpressionError on malformed, ill-typed, or disallowed input.
 *
 * Compilation happens once when the notebook loads (see
 * compileUiSpecConditionals), so results are not cached here - the same source
 * can legitimately compile differently against different field types.
 *
 * @param source The expression source, e.g. "{Width} * {Height}"
 * @param fieldTypes Types of the fields the expression may reference
 * @param requiredType The type the expression must produce, if constrained
 * @returns The compiled expression: references, return type, and evaluator
 */
export const compileComputedExpression = (
  source: string,
  fieldTypes: Map<string, ExprType>,
  requiredType?: ExprType
): CompiledExpression => {
  const {processed, placeholders} = substituteReferences(source);

  let ast: jsep.Expression;
  try {
    ast = jsep(processed);
  } catch (e) {
    throw new ExpressionError((e as Error).message);
  }

  const refs = new Set<string>();
  const root = compileNode(ast, refs, placeholders, fieldTypes);

  if (requiredType && root.type !== requiredType) {
    throw new ExpressionError(
      `Expression must return ${requiredType}, but returns ${root.type}`
    );
  }

  const evaluate = (scope: Map<string, ExprValue>): ExprValue | null => {
    try {
      const result = root.ev(scope);
      if (root.type === 'number' && !Number.isFinite(result as number)) {
        return null;
      }
      return result;
    } catch {
      return null;
    }
  };

  return {references: [...refs], returnType: root.type, evaluate};
};
