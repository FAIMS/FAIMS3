import {TextField as MuiTextField} from '@mui/material';
import z from 'zod';
import {
  BaseFieldProps,
  BaseFieldPropsSchema,
  FormFieldContextProps,
} from '../../../formModule/types';
import {DefaultRenderer} from '../../../rendering/fields/fallback';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';

const TemplatedStringField = (
  props: BaseFieldProps & FormFieldContextProps
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
        inputProps={{readOnly: true}}
        onBlur={props.handleBlur}
      />
    </FieldWrapper>
  );
};

// generate a zod schema for the value.
const valueSchema = () => {
  return z.string().optional();
};

export const templatedStringFieldSpec: FieldInfo = {
  namespace: 'faims-custom',
  name: 'TemplatedStringField',
  returns: 'faims-core::String',
  component: TemplatedStringField,
  fieldPropsSchema: BaseFieldPropsSchema,
  fieldDataSchemaFunction: valueSchema,
  view: {component: DefaultRenderer, config: {}},
};
