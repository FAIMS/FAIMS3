const stringifyWithUndefined = (obj: any) => {
  return JSON.stringify(
    obj,
    (key, value) => (value === undefined ? '__UNDEFINED__' : value),
    2
  );
};

/**
 * Custom equality function that compares two documents while ignoring property and array ordering
 *
 * Helpful for migration functions where ordering could be unpredictable
 *
 * @param inputDoc The input document
 * @param expectedOutputDoc The expected output document after migration
 * @returns boolean indicating whether the documents are equal
 */
export const areDocsEqual = (
  inputDoc: PouchDB.Core.ExistingDocument<any>,
  expectedOutputDoc: PouchDB.Core.ExistingDocument<any>
): boolean => {
  // Helper function to deep compare values
  const deepCompare = (a: any, b: any): boolean => {
    // If both values are the same reference or primitively equal
    if (a === b) return true;

    // If either is null or undefined but not both (since we already checked a === b)
    if (a == null || b == null) return false;

    // Different types means not equal
    if (typeof a !== typeof b) return false;

    // Handle Date objects
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }

    // For primitive types, we already checked a === b above
    if (typeof a !== 'object') return false; // If we got here, they're not equal

    // Handle arrays - this is a more accurate way to compare arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;

      // Create a copy of b that we can mark elements as "used"
      const bUsed = new Array(b.length).fill(false);

      // For each element in a, find a matching unused element in b
      for (let i = 0; i < a.length; i++) {
        let found = false;
        for (let j = 0; j < b.length; j++) {
          if (!bUsed[j] && deepCompare(a[i], b[j])) {
            bUsed[j] = true;
            found = true;
            break;
          }
        }
        if (!found) return false;
      }
      return true;
    }

    // For regular objects, compare keys and values
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();

    // If they have different number of keys, they're not equal
    if (aKeys.length !== bKeys.length) return false;

    // Compare sorted keys to ensure same property names
    for (let i = 0; i < aKeys.length; i++) {
      if (aKeys[i] !== bKeys[i]) return false;
    }

    // Check if all values are equal
    return aKeys.every(key => deepCompare(a[key], b[key]));
  };

  try {
    const eq = deepCompare(inputDoc, expectedOutputDoc);
    if (!eq) {
      console.log(
        `Docs input: ${stringifyWithUndefined(inputDoc)} and expected: ${stringifyWithUndefined(expectedOutputDoc)} were not equal when compared!`
      );

      // Debug - try to identify the specific differences
      const aKeys = Object.keys(inputDoc).sort();
      const bKeys = Object.keys(expectedOutputDoc).sort();

      if (aKeys.length !== bKeys.length) {
        console.log(
          `Different number of keys: ${aKeys.length} vs ${bKeys.length}`
        );
        console.log(
          `Keys only in input: ${aKeys.filter(k => !bKeys.includes(k))}`
        );
        console.log(
          `Keys only in expected: ${bKeys.filter(k => !aKeys.includes(k))}`
        );
      } else {
        // Check each key for differences
        for (const key of aKeys) {
          if (!deepCompare(inputDoc[key], expectedOutputDoc[key])) {
            console.log(`Difference found in key: ${key}`);
            console.log(`Input value: ${JSON.stringify(inputDoc[key])}`);
            console.log(
              `Expected value: ${JSON.stringify(expectedOutputDoc[key])}`
            );
          }
        }
      }

      return false;
    }
    return true;
  } catch (error) {
    console.error('Error during comparison:', error);
    return false;
  }
};
