// Copied and modified from jest, see
// https://github.com/facebook/jest/blob/1be8d737abd0e2f30e3314184a0efc372ad6d88f/packages/expect/src/jasmineUtils.ts#L65

/*
Copyright (c) 2008-2016 Pivotal Labs
Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:
The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/* eslint-disable */


// Extracted out of jasmine 2.5.2
export function equals(
  a: unknown,
  b: unknown,
  customTesters?: Array<any>,
  strictCheck?: boolean,
): boolean {
  customTesters = customTesters || [];
  return eq(a, b, [], [], customTesters, strictCheck ? hasKey : hasDefinedKey);
}

const functionToString = Function.prototype.toString;

function isAsymmetric(obj: any) {
  return !!obj && isA('Function', obj.asymmetricMatch);
}

function asymmetricMatch(a: any, b: any) {
  var asymmetricA = isAsymmetric(a),
    asymmetricB = isAsymmetric(b);

  if (asymmetricA && asymmetricB) {
    return undefined;
  }

  if (asymmetricA) {
    return a.asymmetricMatch(b);
  }

  if (asymmetricB) {
    return b.asymmetricMatch(a);
  }
}

// Equality function lovingly adapted from isEqual in
//   [Underscore](http://underscorejs.org)
function eq(
  a: any,
  b: any,
  aStack: Array<unknown>,
  bStack: Array<unknown>,
  customTesters: Array<any>,
  hasKey: any,
): boolean {
  var result = true;

  var asymmetricResult = asymmetricMatch(a, b);
  if (asymmetricResult !== undefined) {
    return asymmetricResult;
  }

  for (var i = 0; i < customTesters.length; i++) {
    var customTesterResult = customTesters[i](a, b);
    if (customTesterResult !== undefined) {
      return customTesterResult;
    }
  }

  // Equivalent to a instanceof Error && b instanceof Error
  // however instanceof didn't seem to work
  if (a !== null && typeof a === 'object' && 'name' in a && 'message' in a &&
    b !== null && typeof b === 'object' && 'name' in b && 'message' in b) {
    return a.message == b.message;
  }

  // This has NaN equal to NaN and -0 not equal to 0. I'm not adding in a NaN
  // check now, but we may want this in the future.
  if (Object.is(a, b)) {
    return true;
  }
  // A strict comparison is necessary because `null == undefined`.
  if (a === null || b === null) {
    return a === b;
  }
  // This ensures that 0 equals -0, not sure if anything else will break
  if (a === b) {
    return true;
  }
  var className = Object.prototype.toString.call(a);
  if (className != Object.prototype.toString.call(b)) {
    return false;
  }
  switch (className) {
    case '[object Boolean]':
    case '[object String]':
    case '[object Number]':
      if (typeof a !== typeof b) {
        // One is a primitive, one a `new Primitive()`
        return false;
      } else if (typeof a !== 'object' && typeof b !== 'object') {
        // both are proper primitives
        return Object.is(a, b);
      } else {
        // both are `new Primitive()`s
        return Object.is(a.valueOf(), b.valueOf());
      }
    case '[object Date]':
      // Coerce dates to numeric primitive values. Dates are compared by their
      // millisecond representations. Note that invalid dates with millisecond representations
      // of `NaN` are not equivalent.
      return +a == +b;
    // RegExps are compared by their source patterns and flags.
    case '[object RegExp]':
      return a.source === b.source && a.flags === b.flags;
  }
  if (typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }

  // Use DOM3 method isEqualNode (IE>=9)
  if (isDomNode(a) && isDomNode(b)) {
    return a.isEqualNode(b);
  }

  // Used to detect circular references.
  var length = aStack.length;
  while (length--) {
    // Linear search. Performance is inversely proportional to the number of
    // unique nested structures.
    // circular references at same depth are equal
    // circular reference is not equal to non-circular one
    if (aStack[length] === a) {
      return bStack[length] === b;
    } else if (bStack[length] === b) {
      return false;
    }
  }
  // Add the first object to the stack of traversed objects.
  aStack.push(a);
  bStack.push(b);
  var size = 0;
  // Recursively compare objects and arrays.
  // Compare array lengths to determine if a deep comparison is necessary.
  if (className == '[object Array]') {
    size = a.length;
    if (size !== b.length) {
      return false;
    }

    while (size--) {
      result = eq(a[size], b[size], aStack, bStack, customTesters, hasKey);
      if (!result) {
        return false;
      }
    }
  }

  // Deep compare objects.
  var aKeys = keys(a, className == '[object Array]', hasKey),
    key;
  size = aKeys.length;

  // Ensure that both objects contain the same number of properties before comparing deep equality.
  if (keys(b, className == '[object Array]', hasKey).length !== size) {
    return false;
  }

  while (size--) {
    key = aKeys[size];

    // Deep compare each member
    result =
      hasKey(b, key) &&
      eq(a[key], b[key], aStack, bStack, customTesters, hasKey);

    if (!result) {
      return false;
    }
  }
  // Remove the first object from the stack of traversed objects.
  aStack.pop();
  bStack.pop();

  return result;
}

function keys(
  obj: object,
  isArray: boolean,
  hasKey: (obj: object, key: string) => boolean,
) {
  var allKeys = (function(o) {
    var keys: string[] = [];
    for (var key in o) {
      if (hasKey(o, key)) {
        keys.push(key);
      }
    }
    return keys.concat(
      (Object.getOwnPropertySymbols(o) as Array<any>).filter(
        symbol =>
          (Object.getOwnPropertyDescriptor(o, symbol) as PropertyDescriptor)
            .enumerable,
      ),
    );
  })(obj);

  if (!isArray) {
    return allKeys;
  }

  var extraKeys: string[] = [];
  if (allKeys.length === 0) {
    return allKeys;
  }

  for (var x = 0; x < allKeys.length; x++) {
    if (
      typeof allKeys[x] === 'symbol' ||
      !allKeys[x].match(/^[0-9]+$/) ||
      Number(allKeys[x]) >= 4294967295
    ) {
      extraKeys.push(allKeys[x]);
    }
  }

  return extraKeys;
}

function hasDefinedKey(obj: any, key: string) {
  return hasKey(obj, key) && obj[key] !== undefined;
}

function hasKey(obj: any, key: string) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function isA(typeName: string, value: unknown) {
  return Object.prototype.toString.apply(value) === '[object ' + typeName + ']';
}

function isDomNode(obj: any): boolean {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof obj.nodeType === 'number' &&
    typeof obj.nodeName === 'string' &&
    typeof obj.isEqualNode === 'function'
  );
}
