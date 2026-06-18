import {TextField as MuiTextField} from '@mui/material';
import z from 'zod';
import {BaseFieldParametersSchema} from '@faims3/data-model';
import {FormFieldContextProps} from '../../../formModule/types';
import {DefaultRenderer} from '../../../rendering/fields/fallback';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';

const ComputedFieldPropsSchema = BaseFieldParametersSchema.extend({
  // Arithmetic expression over other numeric field names in the same form.
  expression: z.string(),
});
type ComputedFieldProps = z.infer<typeof ComputedFieldPropsSchema>;
type ComputedFieldFullProps = ComputedFieldProps & FormFieldContextProps;

/**
 * Read-only field displaying a number derived from an arithmetic expression.
 * The value is computed at the form-manager level (see computedFields.ts), so
 * this component only renders the current value.
 */
const ComputedField = (props: ComputedFieldFullProps) => {
  const rawValue = props.state.value?.data;
  const value =
    rawValue === null || rawValue === undefined ? '' : String(rawValue);
  return (
    <FieldWrapper
      heading={props.label}
      required={props.required}
      subheading={props.helperText}
      advancedHelperText={props.advancedHelperText}
      errors={props.state.meta.errors as unknown as string[]}
    >
      <MuiTextField
        value={value}
        fullWidth
        disabled={true}
        variant="outlined"
        onBlur={props.handleBlur}
      />
    </FieldWrapper>
  );
};

// The value is null until every referenced field has a numeric value.
const valueSchema = (props: ComputedFieldProps) => {
  const base = z.number().nullable();
  if (props.required) {
    return base.refine(v => v !== null, {
      message: 'This value could not be computed yet.',
    });
  }
  return base.optional();
};

export const computedFieldSpec: FieldInfo<ComputedFieldFullProps> = {
  namespace: 'faims-custom',
  name: 'ComputedField',
  returns: 'faims-core::Number',
  component: ComputedField,
  fieldPropsSchema: ComputedFieldPropsSchema,
  fieldDataSchemaFunction: valueSchema,
  view: {component: DefaultRenderer, config: {}},
};
