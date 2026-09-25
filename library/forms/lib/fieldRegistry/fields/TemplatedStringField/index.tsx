import {TextField as MuiTextField} from '@mui/material';
import z from 'zod';
import {schemaWithAbsent} from '../../../validationModule/readableErrors';
import {
  BaseFieldParameters,
  BaseFieldParametersSchema,
} from '@faims3/data-model';
import {FormFieldContextProps} from '../../../formModule/types';
import {DefaultRenderer} from '../../../rendering/fields/fallback';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';

export const TemplatedStringPropsSchema = BaseFieldParametersSchema.extend({
  /** Mustache template rendered into the field's read-only value. */
  template: z.string().optional(),
  /** Legacy label container retained for un-migrated templated-string fields. */
  InputLabelProps: z
    .object({label: z.string().optional()})
    .passthrough()
    .optional(),
});
export type TemplatedStringProps = z.infer<typeof TemplatedStringPropsSchema>;

const TemplatedStringField = (
  props: BaseFieldParameters & FormFieldContextProps
) => {
  const rawValue = props.state.value?.data ?? undefined;
  const value: string | undefined = rawValue as string | undefined;

  // The field wrapper is used to provide consistent styling, labels, helper
  // text, etc.
  return (
    <FieldWrapper
      heading={props.label}
      required={props.required}
      subheading={props.helperText}
      advancedHelperText={props.advancedHelperText}
      errors={props.state.meta.errors as unknown as string[]}
    >
      <MuiTextField
        value={value ?? '...'}
        fullWidth
        disabled={true}
        // Placeholder breaks when update occurs
        placeholder={undefined}
        variant="outlined"
        slotProps={{htmlInput: {readOnly: true}}}
        onBlur={props.handleBlur}
      />
    </FieldWrapper>
  );
};

// generate a zod schema for the value.
// The value is produced by the template engine, so a missing result must not
// fail with a type error or block submit before the template has run.
const valueSchema = () => {
  return schemaWithAbsent('', z.string({error: 'Enter valid text'}));
};

export const templatedStringFieldSpec: FieldInfo = {
  namespace: 'faims-custom',
  name: 'TemplatedStringField',
  returns: 'faims-core::String',
  component: TemplatedStringField,
  fieldPropsSchema: TemplatedStringPropsSchema,
  fieldDataSchemaFunction: valueSchema,
  view: {component: DefaultRenderer, config: {}},
};
