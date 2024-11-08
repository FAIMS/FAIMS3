import {ProjectUIModel} from '@faims3/data-model/build/src/types';

/**
 * Retrieves the keys of fields that are marked as required from the given project UI model.
 * @param {string} viewset - name of the viewset we are interested in
 * @param {ProjectUIModel} uiSpec - The project UI Spec
 * @returns {string[]} An array of keys representing the fields that are marked as required.
 */
export const requiredFields = (
  viewset: string,
  uiSpec: ProjectUIModel
): string[] => {
  const required: string[] = [];
  if (viewset in uiSpec.viewsets) {
    const views = uiSpec.viewsets[viewset].views;

    views.forEach((view: string) => {
      const fields = uiSpec.views[view].fields;
      fields.forEach((fieldname: string) => {
        if (uiSpec.fields[fieldname]['component-parameters'].required)
          required.push(fieldname);
      });
    });
  }
  return required;
};

/**
 * Determines whether a given value is considered "empty".
 * A value is considered empty if it is an empty array, an empty string, or explicitly set to null.
 *
 * @param {any} value - The value to be checked. It can be of any type.
 * @returns {boolean} - Returns true if the value is considered empty, otherwise false.
 */
const emptyValue = (value: any): boolean => {
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'string') return ['', '1'].includes(value);

  return value === null;
};

/**
 * Calculates the percentage of completed fields based on the provided field names and their corresponding values.
 *
 * @param {string[]} fields - An array of field names to check for completion.
 * @param {object} values - An object containing the field values where the keys match the field names.
 * @returns {number} - A decimal value representing the percentage of fields that are not empty.
 */
export const percentComplete = (fields: string[], values: object): number =>
  fields
    .map(field =>
      Object.prototype.hasOwnProperty.call(values, field) &&
      !emptyValue(values[field as keyof typeof values])
        ? 1
        : 0
    )
    .reduce((a: number, b: number) => a + b, 0) / fields.length;
