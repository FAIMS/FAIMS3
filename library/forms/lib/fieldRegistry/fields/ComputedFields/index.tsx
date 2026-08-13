import {TextField as MuiTextField} from '@mui/material';
import z from 'zod';
import {BaseFieldParametersSchema} from '@faims3/data-model';
import {FormFieldContextProps} from '../../../formModule/types';
import {DefaultRenderer} from '../../../rendering/fields/fallback';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';

const ComputedFieldPropsSchema = BaseFieldParametersSchema.extend({
  // Typed expression over other fields in the same form; field references are
  // written in braces, e.g. {Width} * {Height}.
  expression: z.string(),
});

type ComputedFieldProps = z.infer<typeof ComputedFieldPropsSchema>;
type ComputedFieldFullProps = ComputedFieldProps & FormFieldContextProps;

/**
 * Read-only field displaying a value derived from a typed expression. The
 * value is computed at the form-manager level (see computedFields.ts), so this
 * component only renders the current value. Shared by ComputedNumber and
 * ComputedText; only the declared return type and value schema differ.
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

// The value is null until every referenced field has a usable value.
const numberValueSchema = (props: ComputedFieldProps) => {
  const base = z.number().nullable();
  if (props.required) {
    return base.refine(v => v !== null, {
      message: 'This value could not be computed yet.',
    });
  }
  return base.optional();
};

const textValueSchema = (props: ComputedFieldProps) => {
  const base = z.string().nullable();
  if (props.required) {
    return base.refine(v => v !== null, {
      message: 'This value could not be computed yet.',
    });
  }
  return base.optional();
};

export const computedNumberSpec: FieldInfo<ComputedFieldFullProps> = {
  namespace: 'faims-custom',
  name: 'ComputedNumber',
  returns: 'faims-core::Number',
  component: ComputedField,
  fieldPropsSchema: ComputedFieldPropsSchema,
  fieldDataSchemaFunction: numberValueSchema,
  view: {component: DefaultRenderer, config: {}},
};

export const computedTextSpec: FieldInfo<ComputedFieldFullProps> = {
  namespace: 'faims-custom',
  name: 'ComputedText',
  returns: 'faims-core::String',
  component: ComputedField,
  fieldPropsSchema: ComputedFieldPropsSchema,
  fieldDataSchemaFunction: textValueSchema,
  view: {component: DefaultRenderer, config: {}},
};
