import {AutoIncrementFieldRef, AutoIncrementService} from '../../incrementer';
import {FaimsForm, FaimsFormData} from '../../types';

export interface InitializeAutoIncrementFieldsParams {
  /** The form instance to update */
  form: FaimsForm;
  /** The form ID to filter auto-increment fields */
  formId: string;
  /** The auto-increment service */
  incrementerService: AutoIncrementService;
  /** Initial data - fields with existing values won't be overwritten */
  initialData?: FaimsFormData;
  /** Called if any field couldn't get a value (ranges exhausted/not configured) */
  onMissingRanges?: (fieldRefs: AutoIncrementFieldRef[]) => void;
}

export interface InitializeAutoIncrementFieldsResult {
  /** Fields that were successfully initialized */
  initialized: AutoIncrementFieldRef[];
  /** Fields that couldn't get values (no ranges or exhausted) */
  missingRanges: AutoIncrementFieldRef[];
  /** Fields that were skipped because they already had values */
  skipped: AutoIncrementFieldRef[];
}

/**
 * Initializes auto-increment fields on a form by fetching next values
 * from the incrementer service and setting them on the form.
 *
 * Only sets values for fields that don't already have a value in initialData.
 */
export async function initializeAutoIncrementFields({
  form,
  formId,
  incrementerService,
  initialData,
  onMissingRanges,
}: InitializeAutoIncrementFieldsParams): Promise<InitializeAutoIncrementFieldsResult> {
  const result: InitializeAutoIncrementFieldsResult = {
    initialized: [],
    missingRanges: [],
    skipped: [],
  };

  // Get all auto-increment field refs for this form
  const allRefs = await incrementerService.getFieldRefs();
  const formRefs = allRefs.filter(ref => ref.formId === formId);

  for (const ref of formRefs) {
    const fieldId = ref.fieldId;

    // Check if field already has a value
    const existingFieldValue = initialData?.[fieldId];
    const existingValue = existingFieldValue?.data;
    const hasValue =
      existingValue !== null &&
      existingValue !== undefined &&
      existingValue !== '';

    if (hasValue) {
      result.skipped.push(ref);
      continue;
    }

    // Get next value from incrementer
    const incrementer = incrementerService.getIncrementer(ref);
    const value = await incrementer.getNextValueFormatted(ref.numDigits);

    if (value === undefined) {
      result.missingRanges.push(ref);
      continue;
    }

    // Set the value on the form (override only the data property)
    form.setFieldValue(
      fieldId,
      {...(existingFieldValue ?? {}), data: value},
      // Run listeners which triggers templated string updates etc
      {dontRunListeners: false}
    );
    result.initialized.push(ref);
  }

  // Notify caller if any fields couldn't get values
  if (result.missingRanges.length > 0 && onMissingRanges) {
    onMissingRanges(result.missingRanges);
  }

  return result;
}
