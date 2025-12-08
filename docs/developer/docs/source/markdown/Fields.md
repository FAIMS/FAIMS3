# Adding Fields Types to FAIMS

This document describes the requirements for adding a new field type to the FAIMS
app.

The form manager (FormManager) and individual field components are defined in the
`library/forms` module in the project as a separate module that can be used in both
the mobile app (for data entry) and the form designer (for form preview).

## How Fields Come to Be

The forms presented by the app are defined in the JSON UI Specification which is part
of the JSON notebook definition/schema file (along with the notebook metadata). The
UI specification defines a list of fields. Each field is a chunk of JSON that defines
the type of the field and any option settings for this particular instance.

A FAIMS field consists of a component that renders the field and captures user
data. This component is registered with the app and the rest happens automatically
as long as the component does the right things.

## Adding a New Field Type

Here is the overall
process and requirements for a new field.

### Define the Component Props Schema

The field is configured with a set of properties that will be part of the field
definition in the JSON UISpec.  There is a base set of properties defined
as `BaseFieldPropsSchema` that includes the field name, label, required and disabled
flags and helper text settings.   If your new field has no special settings then
you can use this schema directly (and it's associated type `BaseFieldProps`).
Otherwise you would extend this schema with your new options. For example, the
select field adds a list of options:

```typescript
const SelectFieldPropsSchema = BaseFieldPropsSchema.extend({
  ElementProps: z.object({
    options: z.array(
      z.object({
        value: z.string(),
        label: z.string(),
        key: z.string().optional(),
      })
    ),
  }),
  select_others: z.string().optional(),
});
type SelectFieldProps = z.infer<typeof SelectFieldPropsSchema>;
```

This schema will be used to validate fields of this type in the UISpec.

### Define the Field Component

The field is a regular React component that renders the required UI to capture
the data. In this case, we want a number of text fields to capture the
different parts of the address and an overall display of the textual form
of the address.

The component signature should be:

```typescript
const Select = (props: SelectFieldProps & FormFieldContextProps)
```

`FormFieldContextProps` are additional properties that help control the form
field behaviour.

```typescript
export type FormFieldContextProps = {
  state: FaimsFormFieldState;
  setFieldData: (value: any) => void;
  setFieldAnnotation: (value: FormAnnotation) => void;
  setFieldAttachment: (value: FaimsAttachment) => void;
  handleBlur: () => void;
  context: FormContext;
};
```

The current value of the field can be found in `props.state.value`, this is of 
type `FormDataEntry` and contains properties for the `data`, `annotations` and
`attachments`. Note that this might
be undefined and the `data` property will have unknown type so you will want to use something like
this to get the current field value:

```typescript
  const value = (props.state.value?.data as string) || '';
```

The main requirement on the component is to use the callback functions
when a new value for the field is available. `props.setFieldData` will update the data part
of the For example,
in the Address field:

```typescript
const setFieldValue = (a: AddressType) => {
  const dn = `${a.house_number || ''} ${a.road || ''}, ${a.suburb || ''}, ${a.state || ''} ${a.postcode || ''}`;
  setDisplayName(dn);
  setAddress(a);
  props.setFieldData({
    display_name: dn,
    address: a,
  });
};
```

Note that the value that the field generates can be anything from a simple string
to an object. In this case we generate a fragment of a GeocodeJSON object
containing the address data.

The call to `props.setFieldData` etc updates the current record with the new data.

The component can handle any interaction locally. For example, it can show/hide an
edit form when the user clicks the edit icon; the map field pops up a map overlay
to capture map input. As long as the behaviour interacts well with the overall UI,
anything is possible here.

### Define a Value Schema Function

Each field also defines a function that can be used to validate the value of the
field by returning a zod schema for the value based on the field properties.
The select field generates a schema that includes all of the select options
as alternatives:

```typescript
const valueSchema = (props: SelectFieldProps) => {
  const optionValues = props.ElementProps.options.map(option => option.value);
  return z.union(optionValues.map(val => z.literal(val)));
};
```

### Export the FieldInfo Object

The full definition of the field is contained in an instance of `FieldInfo` that
should be exported from your field module.  This contains the following:

```typescript
export const selectFieldSpec: FieldInfo = {
  namespace: 'faims-custom',
  name: 'Select',
  returns: 'faims-core::String',
  component: Select,
  fieldSchema: SelectFieldPropsSchema,
  valueSchemaFunction: valueSchema,
};
```

The field namespace and name are used to select this field from the UISpec, they should
be unique in combination in the system.  Generally the namespace would be `faims-custom`
until we have a good reason to use something else (some old fields use the `formik-material-ui`
namespace but these may well be deprecated, the mapping and QR code fields have their own
namespace because Steve didn't understand namespaces when he wrote them).

The `returns` property defines the return type of the field and should be one of the
values defined in `FieldReturnType` in the forms module.  We don't currently make much use of
this and it might be superseded by the valueSchemaFunction.

### Register the Field

Each field must be registered in the `lib/components/fields/index.ts` module. This is done
just by importing the relevant FieldInfo instance and calling `registerField`:

```typescript
import {selectFieldSpec} from './SelectField';

registerField(selectFieldSpec);
```

### Add the Field to Designer

To allow the field to be added to a new notebook it needs to be added to the
designer. This has it's own register of field types (yes that's redundant) in
`designer/src/fields.tsx`. The entry here is a prototype of the
JSON that needs to be added to a notebook to create the field. Eg.:

```typescript
AddressField: {
    'component-namespace': 'faims-custom',
    'component-name': 'AddressField',
    'type-returned': 'faims-core::JSON',
    'component-parameters': {
      helperText: 'Enter your address',
      required: false,
      name: 'Address',
      label: 'Address',
    },
    validationSchema: [['yup.object'], ['yup.nullable']],
  },
```

The first two lines match with the arguments to `registerField` and allow this
field to be selected. The `type-returned` property defines what type is
returned by the field, however it isn't used (at present).

The `component-parameters` property defines properties that will be passed
to the component via the `props` argument. Here is where you can add
configuration options if needed. You should include the standard
set of options shown here at a minimum.

If you have no additional options for your field then no more work is needed. If
there are extra options then you need to create component in the designer to
customise this field. Look at eg.
`designer/src/components/Fields/MapFormFieldEditor.tsx` for an example. The
component will probably extend the `BaseFieldEditor` component and add any extra
options that are needed.

### Create a Sample Notebook and Test

Now that the designer is configured to produce your new field you can create
a new notebook containing it and test it out in the app.
