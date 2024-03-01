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
 * Filename: conditionals.ts
 * Description:  Evaluate conditional expressions for branching logic etc.
 *
 */

export interface ConditionalExpression {
  operator: string;
  left?: ConditionalExpression;
  right?: ConditionalExpression;
  field?: string;
  value?: any;
}

interface RecordValues {
  [field_name: string]: any;
}

// Create a register of compiler functions
type FieldCompilerFn = (
  e: ConditionalExpression
) => (values: RecordValues) => boolean;
const compileFns: {[fn: string]: FieldCompilerFn} = {};
const registerCompiler = (operator: string, compiler: FieldCompilerFn) => {
  compileFns[operator] = compiler;
};

// compile an is_logic expression for backward compatibility
// return a comparisonFn
export const compileIsLogic = (isLogic: {[field_name: string]: any}) => {
  return (values: RecordValues) => {
    for (const field in isLogic) {
      if (!isLogic[field].includes(values[field])) return false;
    }
    return true;
  };
};

// compile an expression into a function that will evaluate
// that expression given a set of field values
export const compileExpression = (
  expression: ConditionalExpression | undefined
) => {
  // if we don't get an expression, then this field/view has no condition
  // so return a fn that will always return true
  if (expression === undefined) return () => true;
  if (expression.operator in compileFns) {
    return compileFns[expression.operator](expression);
  } else {
    throw new Error(
      `Unknown operator ${expression.operator} in conditional expression`
    );
  }
};

registerCompiler('equal', (expression: ConditionalExpression) => {
  return (values: RecordValues) => {
    if (expression.field && expression.field in values)
      return expression.value === values[expression.field];
    else return false;
  };
});

registerCompiler('not-equal', (expression: ConditionalExpression) => {
  return (values: RecordValues) => {
    if (expression.field && expression.field in values)
      return expression.value !== values[expression.field];
    else return true; // because if it isn't there, it isn't equal to X
  };
});

registerCompiler('greater', (expression: ConditionalExpression) => {
  return (values: RecordValues) => {
    if (expression.field && expression.field in values)
      return values[expression.field] > expression.value;
    else return false;
  };
});

registerCompiler('greater-equal', (expression: ConditionalExpression) => {
  return (values: RecordValues) => {
    if (expression.field && expression.field in values)
      return values[expression.field] >= expression.value;
    else return false;
  };
});

registerCompiler('less', (expression: ConditionalExpression) => {
  return (values: RecordValues) => {
    if (expression.field && expression.field in values)
      return values[expression.field] < expression.value;
    else return false;
  };
});

registerCompiler('less-equal', (expression: ConditionalExpression) => {
  return (values: RecordValues) => {
    if (expression.field && expression.field in values)
      return values[expression.field] <= expression.value;
    else return false;
  };
});

registerCompiler('regex', (expression: ConditionalExpression) => {
  return (values: RecordValues) => {
    if (expression.field && expression.field in values) {
      const re = new RegExp(expression.value);
      return re.test(values[expression.field]);
    } else return false;
  };
});

registerCompiler('or', (expression: ConditionalExpression) => {
  const lFn = expression.left
    ? compileExpression(expression.left)
    : () => false;
  const rFn = expression.right
    ? compileExpression(expression.right)
    : () => false;
  return (values: RecordValues) => {
    return lFn(values) || rFn(values);
  };
});

registerCompiler('and', (expression: ConditionalExpression) => {
  const lFn = expression.left
    ? compileExpression(expression.left)
    : () => false;
  const rFn = expression.right
    ? compileExpression(expression.right)
    : () => false;
  return (values: RecordValues) => {
    return lFn(values) && rFn(values);
  };
});
