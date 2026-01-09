import {describe, it, expect} from 'vitest';
import {z} from 'zod';
import {
  FormValidation,
  DEFAULT_VALIDATION_SETTINGS,
  CompiledFormSchema,
} from './validation';
import {
  compileUiSpecConditionals,
  decodeUiSpec,
  EncodedUISpecification,
  getFieldNamesForViewset,
  currentlyVisibleFields,
} from '@faims3/data-model';
import sampleNotebook from '../../src/sample-notebook.json';

const uiSpec = decodeUiSpec(
  sampleNotebook['ui-specification'] as EncodedUISpecification
);
compileUiSpecConditionals(uiSpec);

const SAMPLE_VALID_DATA = {
  'First-name': 'John',
  'Last-name': 'Doe',
  Selection: 'Primary **option**',
};

describe('FormValidation', () => {
  describe('DEFAULT_VALIDATION_SETTINGS', () => {
    it('should have visibleBehaviour set to ignore', () => {
      expect(DEFAULT_VALIDATION_SETTINGS.visibleBehaviour).toBe('ignore');
    });
  });

  describe('getRelevantFields', () => {
    it('should return all fields when visibleBehaviour is include', () => {
      const result = FormValidation.getRelevantFields({
        uiSpec,
        formId: 'Person',
        config: {visibleBehaviour: 'include'},
      });

      const expected = getFieldNamesForViewset({
        uiSpecification: uiSpec,
        viewSetId: 'Person',
      });

      expect(result).toEqual(expected);
    });

    it('should return only visible fields when visibleBehaviour is ignore', () => {
      const data = {
        'First-name': 'John',
        'Last-name': 'Doe',
        'Male-or-female': '',
      };
      const result = FormValidation.getRelevantFields({
        uiSpec,
        formId: 'Person',
        data,
        config: {visibleBehaviour: 'ignore'},
      });

      const expected = currentlyVisibleFields({
        values: data,
        uiSpec,
        viewsetId: 'Person',
      });

      expect(result).toEqual(expected);
    });

    it('should include conditional field when condition is met', () => {
      const data = {'Male-or-female': 'female'};
      const result = FormValidation.getRelevantFields({
        uiSpec,
        formId: 'Person',
        data,
        config: {visibleBehaviour: 'ignore'},
      });

      expect(result).toContain('Female-conditional');
    });

    it('should exclude conditional field when condition is not met', () => {
      const data = {'Male-or-female': 'male'};
      const result = FormValidation.getRelevantFields({
        uiSpec,
        formId: 'Person',
        data,
        config: {visibleBehaviour: 'ignore'},
      });

      expect(result).not.toContain('Female-conditional');
    });

    it('should throw error when visibleBehaviour is ignore and data is missing', () => {
      expect(() =>
        FormValidation.getRelevantFields({
          uiSpec,
          formId: 'Person',
          config: {visibleBehaviour: 'ignore'},
        })
      ).toThrow('Data is required when visibleBehaviour is not "include"');
    });
  });

  describe('getFieldSchema', () => {
    it('should return a schema for an existing field', () => {
      const result = FormValidation.getFieldSchema({
        uiSpec,
        fieldId: 'First-name',
      });

      expect(result).toBeDefined();
    });

    it('should return undefined for non-existent field', () => {
      const result = FormValidation.getFieldSchema({
        uiSpec,
        fieldId: 'NonExistent',
      });

      expect(result).toBeUndefined();
    });
  });

  describe('compileFormSchema', () => {
    it('should compile schemas for all relevant fields', () => {
      const data = {'First-name': '', 'Last-name': ''};
      const result = FormValidation.compileFormSchema({
        uiSpec,
        formId: 'Person',
        data,
      });

      expect(result.fields.length).toBeGreaterThan(0);
      expect(result.schema).toBeDefined();
      expect(typeof result.fieldSchemas).toBe('object');
    });

    it('should include all fields when visibleBehaviour is include', () => {
      const result = FormValidation.compileFormSchema({
        uiSpec,
        formId: 'Person',
        config: {visibleBehaviour: 'include'},
      });

      const allFields = getFieldNamesForViewset({
        uiSpecification: uiSpec,
        viewSetId: 'Person',
      });

      expect(result.fields).toEqual(allFields);
    });
  });

  describe('validateWithCompiledSchema', () => {
    it('should return valid for correct data', () => {
      const compiledSchema: CompiledFormSchema = {
        schema: z.object({
          'First-name': z.string().min(1),
          'Last-name': z.string().min(1),
        }),
        fieldSchemas: {
          'First-name': z.string().min(1),
          'Last-name': z.string().min(1),
        },
        fields: ['First-name', 'Last-name'],
      };

      const result = FormValidation.validateWithCompiledSchema({
        data: {'First-name': 'John', 'Last-name': 'Doe'},
        compiledSchema,
      });

      expect(result.valid).toBe(true);
    });

    it('should return errors for invalid data', () => {
      const compiledSchema: CompiledFormSchema = {
        schema: z.object({
          'First-name': z.string().min(1),
        }),
        fieldSchemas: {'First-name': z.string().min(1)},
        fields: ['First-name'],
      };

      const result = FormValidation.validateWithCompiledSchema({
        data: {'First-name': ''},
        compiledSchema,
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });
  describe('required fields', () => {
    it('optional fields can be excluded', () => {
      const schema = FormValidation.compileFormSchema({
        uiSpec,
        formId: 'Person',
        data: {},
      });
      // This should validate
      expect(schema.schema.safeParse(SAMPLE_VALID_DATA).success).toBeTruthy();
      // This should not validate (as it's missing required fields)
      expect(schema.schema.safeParse({}).success).toBeFalsy();
    });
  });
  describe('selection fields', () => {
    it('should accept either option', () => {
      const schema = FormValidation.compileFormSchema({
        uiSpec,
        formId: 'Person',
        data: {},
      });
      // This should validate
      expect(
        schema.schema.safeParse({
          ...SAMPLE_VALID_DATA,
          Selection: 'Primary **option**',
        }).success
      ).toBeTruthy();
      // And this
      expect(
        schema.schema.safeParse({
          ...SAMPLE_VALID_DATA,
          Selection: 'Secondary *option*',
        }).success
      ).toBeTruthy();
      // But not this!
      expect(
        schema.schema.safeParse({
          ...SAMPLE_VALID_DATA,
          Selection: 'Invalid option',
        }).success
      ).toBeFalsy();
    });
  });
  (describe('form schema compilation and recompilation', () => {
    it('should compile schema', () => {
      FormValidation.compileFormSchema({
        uiSpec,
        formId: 'Person',
        data: {},
      });
    });
    it('should re-compile schema', () => {
      const schema = FormValidation.compileFormSchema({
        uiSpec,
        formId: 'Person',
        data: {},
      });
      expect(schema.schema.shape['Male-name']).not.toBeDefined();
      const updatedSchema = FormValidation.recompileFormSchema({
        existingSchema: schema,
        formId: 'Person',
        uiSpec: uiSpec,
        // This should reveal the 'Male-name' field
        data: {'Male-or-female': 'male'},
      });
      expect(updatedSchema.addedFields).to.include('Male-name');
      expect(updatedSchema.schema.shape['Male-name']).toBeDefined();
    });
  }),
    describe('validateFormDataWithCompiledSchema', () => {
      it('should compile and validate valid data', () => {
        const result = FormValidation.validateFormDataWithCompiledSchema({
          data: SAMPLE_VALID_DATA,
          uiSpec,
          formId: 'Person',
        });
        console.error(JSON.stringify(result, null, 2));

        expect(result.valid).toBe(true);
      });

      it('should validate with all fields when visibleBehaviour is include', () => {
        const data = {
          'First-name': 'John',
          'Last-name': 'Doe',
        };

        const result = FormValidation.validateFormDataWithCompiledSchema({
          data,
          uiSpec,
          formId: 'Person',
          config: {visibleBehaviour: 'include'},
        });

        expect(typeof result.valid).toBe('boolean');
      });
    }));

  describe('validateField', () => {
    it('should validate a single field successfully', () => {
      const result = FormValidation.validateField({
        data: {'First-name': 'John'},
        uiSpec,
        fieldId: 'First-name',
      });

      expect(result.valid).toBe(true);
    });

    it('should return valid for non-existent field', () => {
      const result = FormValidation.validateField({
        data: {},
        uiSpec,
        fieldId: 'NonExistent',
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('validateFormData', () => {
    it('should validate all visible fields', () => {
      const result = FormValidation.validateFormData({
        data: SAMPLE_VALID_DATA,
        uiSpec,
        formId: 'Person',
      });

      expect(result.valid).toBe(true);
    });

    it('should return valid true when no errors', () => {
      const result = FormValidation.validateFormData({
        data: SAMPLE_VALID_DATA,
        uiSpec,
        formId: 'Person',
      });

      console.log(result);

      expect(result.valid).toBe(true);
    });

    it('should ignore hidden data', () => {
      let result = FormValidation.validateFormData({
        data: {
          ...SAMPLE_VALID_DATA,
          'Male-or-female': 'female',
          // This value is not relevant - so can be invalid
          'Male-name': 123,
        },
        uiSpec,
        formId: 'Person',
      });

      console.log(result);
      expect(result.valid).toBe(true);

      // Now this should fail
      result = FormValidation.validateFormData({
        data: {
          ...SAMPLE_VALID_DATA,
          'Male-or-female': 'male',
          // This value is now
          'Male-name': 123,
        },
        uiSpec,
        formId: 'Person',
      });

      console.log(result);
      expect(result.valid).toBe(false);

      // Now this should fail too as we validate all
      result = FormValidation.validateFormData({
        data: {
          ...SAMPLE_VALID_DATA,
          'Male-or-female': 'female',
          // This value is now
          'Male-name': 123,
        },
        uiSpec,
        formId: 'Person',
        config: {visibleBehaviour: 'include'},
      });

      console.log(result);
      expect(result.valid).toBe(false);
    });
  });
});
