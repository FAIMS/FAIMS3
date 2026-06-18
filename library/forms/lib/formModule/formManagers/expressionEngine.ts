import jsep from 'jsep';
import ternary from '@jsep-plugin/ternary';

// Enable the ternary operator (x ? y : z). Comparison and logical operators
// (==, <, >, &&, ||) are built into jsep already.
jsep.plugins.register(ternary);

/** Thrown when an expression is malformed or contains a disallowed element. */
export class ExpressionError extends Error {}

// Node types this evaluator is willing to execute. Anything else (member
// access, function calls, arrays, etc.) is rejected at compile time, so an
// expression can only do arithmetic and conditionals over field values. This
// is the safety boundary: there is no path to property access or invocation.
type EvalNode =
  | {type: 'Literal'; value: unknown}
  | {type: 'Identifier'; name: string}
  | {type: 'UnaryExpression'; operator: string; argument: EvalNode}
  | {
      type: 'BinaryExpression';
      operator: string;
      left: EvalNode;
      right: EvalNode;
    }
  | {
      type: 'ConditionalExpression';
      test: EvalNode;
      consequent: EvalNode;
      alternate: EvalNode;
    };

/**
 * A parsed, validated expression ready to evaluate.
 */
export interface CompiledExpression {
  /** Field IDs referenced by the expression. */
  references: string[];
  /**
   * Evaluates against a scope of field ID -> numeric value. Returns null when
   * the result is not a finite number or evaluation fails.
   */
  evaluate: (scope: Map<string, number>) => number | null;
}

const cache = new Map<string, CompiledExpression>();

// Validates the AST against the allowed node types and collects identifiers.
// Throws ExpressionError on any disallowed node.
function validate(node: jsep.Expression, refs: Set<string>): void {
  switch (node.type) {
    case 'Literal':
      return;
    case 'Identifier':
      refs.add((node as unknown as {name: string}).name);
      return;
    case 'UnaryExpression':
      validate((node as unknown as {argument: jsep.Expression}).argument, refs);
      return;
    case 'BinaryExpression': {
      const n = node as unknown as {
        left: jsep.Expression;
        right: jsep.Expression;
      };
      validate(n.left, refs);
      validate(n.right, refs);
      return;
    }
    case 'ConditionalExpression': {
      const n = node as unknown as {
        test: jsep.Expression;
        consequent: jsep.Expression;
        alternate: jsep.Expression;
      };
      validate(n.test, refs);
      validate(n.consequent, refs);
      validate(n.alternate, refs);
      return;
    }
    default:
      throw new ExpressionError(`Unsupported expression element: ${node.type}`);
  }
}

function evalNode(node: EvalNode, scope: Map<string, number>): number {
  switch (node.type) {
    case 'Literal': {
      const v = node.value;
      if (typeof v === 'number') return v;
      if (typeof v === 'boolean') return v ? 1 : 0;
      throw new ExpressionError(
        'Only numeric and boolean literals are allowed'
      );
    }
    case 'Identifier': {
      const v = scope.get(node.name);
      if (v === undefined) {
        throw new ExpressionError(`Unknown field: ${node.name}`);
      }
      return v;
    }
    case 'UnaryExpression': {
      const arg = evalNode(node.argument, scope);
      switch (node.operator) {
        case '-':
          return -arg;
        case '+':
          return arg;
        case '!':
          return arg ? 0 : 1;
      }
      throw new ExpressionError(`Unsupported unary operator: ${node.operator}`);
    }
    case 'BinaryExpression': {
      const l = evalNode(node.left, scope);
      const r = evalNode(node.right, scope);
      switch (node.operator) {
        case '+':
          return l + r;
        case '-':
          return l - r;
        case '*':
          return l * r;
        case '/':
          return l / r;
        case '%':
          return l % r;
        case '==':
          return l === r ? 1 : 0;
        case '!=':
          return l !== r ? 1 : 0;
        case '<':
          return l < r ? 1 : 0;
        case '>':
          return l > r ? 1 : 0;
        case '<=':
          return l <= r ? 1 : 0;
        case '>=':
          return l >= r ? 1 : 0;
        case '&&':
          return l && r ? 1 : 0;
        case '||':
          return l || r ? 1 : 0;
      }
      throw new ExpressionError(`Unsupported operator: ${node.operator}`);
    }
    case 'ConditionalExpression':
      return evalNode(node.test, scope)
        ? evalNode(node.consequent, scope)
        : evalNode(node.alternate, scope);
  }
}

/**
 * Parses and validates an arithmetic/conditional expression. Throws
 * ExpressionError on malformed or disallowed input. Cached by source string.
 */
export function compileExpression(source: string): CompiledExpression {
  const cached = cache.get(source);
  if (cached) return cached;

  let ast: jsep.Expression;
  try {
    ast = jsep(source);
  } catch (e) {
    throw new ExpressionError((e as Error).message);
  }

  const refs = new Set<string>();
  validate(ast, refs);

  const evaluate = (scope: Map<string, number>): number | null => {
    try {
      const result = evalNode(ast as unknown as EvalNode, scope);
      return Number.isFinite(result) ? result : null;
    } catch {
      return null;
    }
  };

  const compiled: CompiledExpression = {references: [...refs], evaluate};
  cache.set(source, compiled);
  return compiled;
}
