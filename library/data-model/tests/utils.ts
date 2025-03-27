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
    // If both values are null or undefined, they're equal
    if (a === null && b === null) return true;
    if (a === undefined && b === undefined) return true;

    // If one is null/undefined but the other isn't, they're not equal
    if (a === null || a === undefined || b === null || b === undefined)
      return false;

    // Different types means not equal
    if (typeof a !== typeof b) return false;

    // For primitive types, direct comparison
    if (typeof a !== 'object') return a === b;

    // Both are objects (including arrays)
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;

      // For arrays, we need to check if every element in a exists in b
      // regardless of position, and vice versa
      return (
        a.every(aItem => b.some(bItem => deepCompare(aItem, bItem))) &&
        b.every(bItem => a.some(aItem => deepCompare(aItem, bItem)))
      );
    }

    // For regular objects, compare keys and values
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);

    // If they have different number of keys, they're not equal
    if (aKeys.length !== bKeys.length) return false;

    // Check if all keys in a exist in b and their values are equal
    return aKeys.every(key => {
      return bKeys.includes(key) && deepCompare(a[key], b[key]);
    });
  };

  return deepCompare(inputDoc, expectedOutputDoc);
};
