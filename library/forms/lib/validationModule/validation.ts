import {z, ZodTypeAny, ZodObject, ZodRawShape} from 'zod';
import {
  currentlyVisibleFields,
  getFieldNamesForViewset,
  UISpecification,
  ValuesObject,
} from '@faims3/data-model';
import {
  FieldValidationResult,
  ValidationResult as FormValidationResult,
  ValidationError,
  ValidationSettings,
} from './types';
import {getFieldInfo} from '../fieldRegistry';

/**
 * Default validation settings.
 *
 * - `visibleBehaviour: 'ignore'` means only currently visible fields are validated,
 *   which requires form data to determine field visibility.
 */
export const DEFAULT_VALIDATION_SETTINGS: ValidationSettings = {
  visibleBehaviour: 'ignore',
};

/**
 * Represents a pre-compiled Zod schema for a form.
 *
 * Pre-compiling schemas improves performance when the same form
 * needs to be validated multiple times (e.g., on each keystroke).
 */
export type CompiledFormSchema<T extends ZodRawShape = ZodRawShape> = {
  /** The combined Zod object schema for all relevant fields */
  schema: ZodObject<T>;
  /** Individual field schemas indexed by field ID */
  fieldSchemas: Record<string, ZodTypeAny>;
  /** List of field IDs included in this schema */
  fields: string[];
};

/**
 * Result of a schema recompilation operation.
 *
 * Extends `CompiledFormSchema` with metadata about what changed during
 * recompilation, useful for debugging or optimization analysis.
 */
export type RecompiledFormSchema<T extends ZodRawShape = ZodRawShape> =
  CompiledFormSchema<T> & {
    /** Fields that were added in this recompilation */
    addedFields: string[];
    /** Fields that were removed in this recompilation */
    removedFields: string[];
    /** Fields that were reused from the previous schema */
    reusedFields: string[];
  };

/**
 * Form validation utilities using Zod schemas.
 *
 * Provides two validation strategies:
 *
 * 1. **Compiled schema validation** - Builds a single Zod object schema from all
 *    field validators, enabling whole-form validation in one pass. More efficient
 *    for repeated validations of the same form structure.
 *
 * 2. **Individual field validation** - Validates each field independently using
 *    its own schema. Simpler but less efficient for full-form validation.
 */
export const FormValidation = {
  /**
   * Compiles a Zod object schema from all field validators for a form.
   *
   * The compiled schema can be reused for multiple validations, which is more
   * efficient than recompiling on each validation pass.
   *
   * @param uiSpec - The UI specification containing field definitions
   * @param formId - The form/viewset ID to compile the schema for
   * @param data - Current form data (required when `visibleBehaviour` is `'ignore'`)
   * @param config - Validation settings controlling which fields to include
   *
   * @returns A compiled schema object containing:
   *   - `schema`: The combined Zod object schema
   *   - `fieldSchemas`: Individual schemas keyed by field ID
   *   - `fields`: Array of field IDs included in the schema
   *
   * @throws Error if `visibleBehaviour` is `'ignore'` and `data` is not provided
   */
  compileFormSchema({
    uiSpec,
    formId,
    data,
    config = DEFAULT_VALIDATION_SETTINGS,
  }: {
    uiSpec: UISpecification;
    formId: string;
    data?: ValuesObject;
    config?: ValidationSettings;
  }): CompiledFormSchema {
    const relevantFields = this.getRelevantFields({
      uiSpec,
      formId,
      data,
      config,
    });

    const shape: Record<string, ZodTypeAny> = {};
    const fieldSchemas: Record<string, ZodTypeAny> = {};

    for (const fieldId of relevantFields) {
      const fieldSchema = this.getFieldSchema({uiSpec, fieldId});
      if (fieldSchema) {
        shape[fieldId] = fieldSchema;
        fieldSchemas[fieldId] = fieldSchema;
      }
    }

    return {
      schema: z.object(shape),
      fieldSchemas,
      fields: relevantFields,
    };
  },

  /**
   * Filters a compiled schema to only include specified fields.
   *
   * This is useful for validating only "touched" fields in a form, where you
   * want to show validation errors only for fields the user has interacted with.
   *
   * @param compiledSchema - A previously compiled form schema
   * @param fieldIds - Array of field IDs to include in the filtered schema
   *
   * @returns A new compiled schema containing only the specified fields.
   *          Fields not present in the original schema are silently ignored.
   */
  filterCompiledSchema({
    compiledSchema,
    fieldIds,
  }: {
    compiledSchema: CompiledFormSchema;
    fieldIds: string[];
  }): CompiledFormSchema {
    const fieldIdSet = new Set(fieldIds);
    const shape: Record<string, ZodTypeAny> = {};
    const fieldSchemas: Record<string, ZodTypeAny> = {};
    const filteredFields: string[] = [];

    for (const fieldId of compiledSchema.fields) {
      if (fieldIdSet.has(fieldId)) {
        const existingSchema = compiledSchema.fieldSchemas[fieldId];
        if (existingSchema) {
          shape[fieldId] = existingSchema;
          fieldSchemas[fieldId] = existingSchema;
          filteredFields.push(fieldId);
        }
      }
    }

    return {
      schema: z.object(shape),
      fieldSchemas,
      fields: filteredFields,
    };
  },

  /**
   * Efficiently recompiles a form schema by reusing existing field schemas where possible.
   *
   * This method is optimized for scenarios where form visibility changes frequently
   * (e.g., conditional fields based on user input) but the underlying field definitions
   * remain stable. It avoids regenerating schemas for fields that persist between
   * compilations.
   *
   * The recompilation process:
   * 1. Determines the new set of relevant (visible) fields
   * 2. Reuses schemas from `existingSchema.fieldSchemas` for fields that still exist
   * 3. Generates new schemas only for newly visible fields
   * 4. Excludes schemas for fields that are no longer visible
   *
   * @param existingSchema - The previously compiled schema to update
   * @param uiSpec - The UI specification containing field definitions
   * @param formId - The form/viewset ID
   * @param data - Current form data (required when `visibleBehaviour` is `'ignore'`)
   * @param config - Validation settings controlling which fields to include
   *
   * @returns A recompiled schema with metadata about changes:
   *   - `schema`: The updated Zod object schema
   *   - `fieldSchemas`: Individual schemas keyed by field ID
   *   - `fields`: Array of field IDs included in the schema
   *   - `addedFields`: Fields newly added in this recompilation
   *   - `removedFields`: Fields removed from the previous schema
   *   - `reusedFields`: Fields whose schemas were reused
   *
   * @throws Error if `visibleBehaviour` is `'ignore'` and `data` is not provided
   */
  recompileFormSchema({
    existingSchema,
    uiSpec,
    formId,
    data,
    config = DEFAULT_VALIDATION_SETTINGS,
  }: {
    existingSchema: CompiledFormSchema;
    uiSpec: UISpecification;
    formId: string;
    data?: ValuesObject;
    config?: ValidationSettings;
  }): RecompiledFormSchema {
    const newRelevantFields = this.getRelevantFields({
      uiSpec,
      formId,
      data,
      config,
    });

    const existingFieldSet = new Set(existingSchema.fields);
    const newFieldSet = new Set(newRelevantFields);

    const addedFields: string[] = [];
    const removedFields: string[] = [];
    const reusedFields: string[] = [];

    // Identify removed fields
    for (const fieldId of existingSchema.fields) {
      if (!newFieldSet.has(fieldId)) {
        removedFields.push(fieldId);
      }
    }

    const shape: Record<string, ZodTypeAny> = {};
    const fieldSchemas: Record<string, ZodTypeAny> = {};

    for (const fieldId of newRelevantFields) {
      if (existingFieldSet.has(fieldId)) {
        // Reuse existing schema
        const existingFieldSchema = existingSchema.fieldSchemas[fieldId];
        if (existingFieldSchema) {
          shape[fieldId] = existingFieldSchema;
          fieldSchemas[fieldId] = existingFieldSchema;
          reusedFields.push(fieldId);
        } else {
          // Edge case: field was in fields array but not in fieldSchemas
          // This shouldn't happen, but handle gracefully by regenerating
          const newFieldSchema = this.getFieldSchema({uiSpec, fieldId});
          if (newFieldSchema) {
            shape[fieldId] = newFieldSchema;
            fieldSchemas[fieldId] = newFieldSchema;
            addedFields.push(fieldId);
          }
        }
      } else {
        // Generate schema for new field
        const newFieldSchema = this.getFieldSchema({uiSpec, fieldId});
        if (newFieldSchema) {
          shape[fieldId] = newFieldSchema;
          fieldSchemas[fieldId] = newFieldSchema;
          addedFields.push(fieldId);
        }
      }
    }

    return {
      schema: z.object(shape),
      fieldSchemas,
      fields: newRelevantFields,
      addedFields,
      removedFields,
      reusedFields,
    };
  },

  /**
   * Determines which fields should be validated based on configuration.
   *
   * @param uiSpec - The UI specification
   * @param formId - The form/viewset ID
   * @param data - Current form data (required for visibility-based filtering)
   * @param config - Validation settings
   *
   * @returns Array of field IDs to validate
   *
   * @throws Error if visibility-based filtering is requested but data is missing
   */
  getRelevantFields({
    uiSpec,
    formId,
    data,
    config = DEFAULT_VALIDATION_SETTINGS,
  }: {
    uiSpec: UISpecification;
    formId: string;
    data?: ValuesObject;
    config?: ValidationSettings;
  }): string[] {
    if (config.visibleBehaviour === 'include') {
      // Include all fields regardless of visibility
      return getFieldNamesForViewset({
        uiSpecification: uiSpec,
        viewSetId: formId,
      });
    }

    // Filter to only currently visible fields
    if (!data) {
      throw new Error(
        'Data is required when visibleBehaviour is not "include" to determine visible fields'
      );
    }

    return currentlyVisibleFields({
      values: data,
      uiSpec,
      viewsetId: formId,
    });
  },

  /**
   * Gets the Zod schema for a single field based on its component configuration.
   *
   * The schema is generated by calling the field component's `valueSchemaFunction`
   * with the field's component parameters.
   *
   * @param uiSpec - The UI specification containing field definitions
   * @param fieldId - The field ID to get the schema for
   *
   * @returns The Zod schema for the field, or `z.unknown()` if the field has no
   *          validator defined. Returns `undefined` if the field doesn't exist.
   */
  getFieldSchema({
    uiSpec,
    fieldId,
  }: {
    uiSpec: UISpecification;
    fieldId: string;
  }): ZodTypeAny | undefined {
    const details = uiSpec.fields[fieldId];
    if (!details) {
      console.warn(`Field ${fieldId} not found in UI specification`);
      return undefined;
    }
    const required =
      (details['component-parameters']?.['required'] as Boolean | undefined) ??
      false;

    const fieldSpec = getFieldInfo({
      name: details['component-name'],
      namespace: details['component-namespace'],
    });

    const modelGenerator = fieldSpec?.fieldDataSchemaFunction;
    if (!modelGenerator) {
      return z.unknown();
    }

    // Make spec optional if needed
    const spec = modelGenerator(details['component-parameters']);
    return required ? spec : spec.nullable().optional();
  },

  /**
   * Validates form data using a pre-compiled schema.
   *
   * This is the most efficient validation method when validating the same form
   * structure multiple times, as it avoids recompiling the schema.
   *
   * @param data - The form data to validate
   * @param compiledSchema - A previously compiled form schema
   *
   * @returns Validation result with `valid: true` on success, or
   *          `valid: false` with an `errors` array on failure
   */
  validateWithCompiledSchema({
    data,
    compiledSchema,
  }: {
    data: ValuesObject;
    compiledSchema: CompiledFormSchema;
  }): FormValidationResult {
    const result = compiledSchema.schema.safeParse(data);

    if (result.success) {
      return {valid: true};
    }

    return {
      valid: false,
      errors: result.error.issues as ValidationError[],
    };
  },

  /**
   * Validates form data by compiling and validating in a single operation.
   *
   * Convenience method that combines `compileFormSchema` and `validateWithCompiledSchema`.
   * Use this for one-off validations; prefer pre-compiled schemas for repeated validations.
   *
   * @param data - The form data to validate
   * @param uiSpec - The UI specification
   * @param formId - The form/viewset ID
   * @param config - Validation settings
   *
   * @returns Validation result
   */
  validateFormDataWithCompiledSchema({
    data,
    uiSpec,
    formId,
    config = DEFAULT_VALIDATION_SETTINGS,
  }: {
    data: ValuesObject;
    uiSpec: UISpecification;
    formId: string;
    config?: ValidationSettings;
  }): FormValidationResult {
    const compiledSchema = this.compileFormSchema({
      uiSpec,
      formId,
      data,
      config,
    });

    return this.validateWithCompiledSchema({data, compiledSchema});
  },

  /**
   * Validates form data by checking each field individually.
   *
   * Consider using `validateFormDataWithCompiledSchema` for better performance.
   * This may be simpler for thin clients that don't want to compile a schema,
   * or are only occasionally validating form data.
   *
   * @param data - The form data to validate
   * @param uiSpec - The UI specification
   * @param formId - The form/viewset ID
   * @param config - Validation settings
   *
   * @returns Validation result with aggregated errors from all fields
   */
  validateFormData({
    data,
    uiSpec,
    formId,
    config = DEFAULT_VALIDATION_SETTINGS,
  }: {
    data: ValuesObject;
    uiSpec: UISpecification;
    formId: string;
    config?: ValidationSettings;
  }): FormValidationResult {
    const relevantFields = this.getRelevantFields({
      uiSpec,
      formId,
      data,
      config,
    });

    const errors: ValidationError[] = [];

    for (const fieldId of relevantFields) {
      const result = this.validateField({data, fieldId, uiSpec});
      if (!result.valid && result.errors) {
        errors.push(...result.errors);
      }
    }

    if (errors.length === 0) {
      return {valid: true};
    }

    return {valid: false, errors};
  },

  /**
   * Validates a single field's value against its schema.
   *
   * @param data - The complete form data object
   * @param uiSpec - The UI specification
   * @param fieldId - The ID of the field to validate
   *
   * @returns Validation result for the specific field
   */
  validateField({
    data,
    uiSpec,
    fieldId,
  }: {
    data: ValuesObject;
    uiSpec: UISpecification;
    fieldId: string;
  }): FieldValidationResult {
    const details = uiSpec.fields[fieldId];
    if (!details) {
      console.warn(`Field "${fieldId}" not found in UI specification`);
      return {valid: true};
    }

    const required =
      (details['component-parameters']?.['required'] as Boolean | undefined) ??
      false;

    const fieldSpec = getFieldInfo({
      name: details['component-name'],
      namespace: details['component-namespace'],
    });

    const modelGenerator = fieldSpec?.fieldDataSchemaFunction;
    if (!modelGenerator) {
      return {valid: true};
    }

    let zodSchema = modelGenerator(details['component-parameters']);
    zodSchema = required ? zodSchema : zodSchema.nullable().optional();

    const result = zodSchema.safeParse(data[fieldId]);

    if (result.success) {
      return {valid: true};
    }

    return {
      valid: false,
      errors: result.error.issues as ValidationError[],
    };
  },
} as const;
