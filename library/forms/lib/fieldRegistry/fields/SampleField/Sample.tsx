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

const SampleField = (props: BaseFieldProps & FormFieldContextProps) => {
  // You may wish to cast this value
  const value = props.state.value?.data || undefined;

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Here you can set field/annotation/attachment info
    props.setFieldData(event.target.value);
  };

  // The field wrapper is used to provide consistent styling, labels, helper
  // text, etc.
  return (
    <FieldWrapper
      heading={props.label}
      required={props.required}
      advancedHelperText={props.advancedHelperText}
      errors={props.state.meta.errors as unknown as string[]}
    >
      {/* Replace with your field component of choice */}
      <MuiTextField
        value={value}
        fullWidth
        onChange={onChange}
        onBlur={props.handleBlur}
        variant="outlined"
      />
    </FieldWrapper>
  );
};

// generate a zod schema for the value.
const valueSchema = () => {
  return z.any();
};

// Export a constant with the information required to
// register this field type
export const sampleFieldSpec: FieldInfo = {
  namespace: 'faims-custom',
  name: 'SampleField',
  returns: 'faims-core::String',
  component: SampleField,
  fieldPropsSchema: BaseFieldPropsSchema,
  fieldDataSchemaFunction: valueSchema,
  // You can override this to provide a customised view only rendering
  view: {component: DefaultRenderer, config: {}},
};
