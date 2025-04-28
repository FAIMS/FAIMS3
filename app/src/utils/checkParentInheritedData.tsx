/**
 * Checks if any parent record has inherited data eligible for display.
 *
 * A field is considered eligible if:
 * - It has a non-null, non-undefined, non-empty value
 * - It is marked as `displayParent: true` in the UI specification
 *
 * @param parentRecords - Array of parent records to check.
 * @param uiSpec - The UI specification defining fields and display rules.
 * @returns True if at least one field qualifies for inherited display, otherwise false.
 */
export function checkIfParentHasInheritedData(
  parentRecords: any[],
  uiSpec: any
): boolean {
  if (!parentRecords || parentRecords.length === 0) {
    return false;
  }

  return parentRecords.some(record => {
    if (!record.persistentData) return false;
    return Object.entries(record.persistentData).some(([fieldName, value]) => {
      if (value === null || value === undefined || value === '') {
        return false;
      }
      const fieldSpec = uiSpec?.fields?.[fieldName];
      return fieldSpec && fieldSpec.displayParent === true;
    });
  });
}
