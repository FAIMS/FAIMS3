# Adding Fields Types to FAIMS

This document describes the requirements for adding a new field type to the FAIMS
app.

## How Fields Come to Be

The forms presented by the app are defined in the JSON UI Specification which is part
of the JSON notebook definition/schema file (along with the notebook metadata).  The
UI specification defines a list of fields. Each field is a chunk of JSON that defines
the type of the field and any option settings for this particular instance.

The form component that is rendered is created by `getComponentFromFieldConfig` in
[fields.tsx](../../app/src/gui/components/record/fields.tsx). This basically
looks up a component in the component registry and then instantiates it using
the Formik `<Field>` component which handles passing and updating form data.

A FAIMS field consists of a component that renders the field and captures user
data.  This component is registered with the app and the rest happens automatically
as long as the component does the right things.

## Adding a New Field Type

Taking the example of the Address Field that has just been added, here is the overall
process and requirements for a new field.

### Define the Field Component

The field is a regular React component that renders the required UI to capture
the data.   In this case, we want a number of text fields to capture the
different parts of the address and an overall display of the textual form
of the address.

The component signature should be:

```typescript
import {FieldProps} from 'formik';

interface Props {
  helperText?: string;
  label?: string;
}

export const AddressField = (props: FieldProps & Props)
```

`FieldProps` provides the formik callback functions and Props defines any local
properties that can be configured on the form.  In the initial version of
the address field there are only the standard `label` and `helperText` properties
but this could also include eg. `country` if we wanted to have that be an
option for the field.

The initial value of the field, if any, will be passed in as `props.field.value`.
This may be null so test this before setting up your initial values. Eg.:

```typescript
  const [address, setAddress] = useState<AddressType>(
    props.field.value?.address || {}
  );
  const [displayName, setDisplayName] = useState(
    props.field.value?.display_name || ''
  );
```

The main requirement on the component is to call `props.form.setFieldValue`
when a new value for the field is available.  Eg.:

```typescript
const setFieldValue = (a: AddressType) => {
    const dn = `${a.house_number || ''} ${a.road || ''}, ${a.suburb || ''}, ${a.state || ''} ${a.postcode || ''}`;
    setDisplayName(dn);
    setAddress(a);
    props.form.setFieldValue(props.field.name, {
      display_name: dn,
      address: a,
    });
  };
```

Note that the value that the field generates can be anything from a simple string
to an object. In this case we generate a fragment of a GeocodeJSON object
containing the address data.

The call to `setFieldValue` updates the current record with the new field
value.

The component can handle any interaction locally. This component can show/hide the
edit form when the user clicks the edit icon.  The map field pops up a map overlay
to capture map input.   As long as the behaviour interacts well with the overall UI,
anything is possible here.

### Register the Field

You now need to register the field so that it is known to the form builder. Do this
in [bundle_components.ts](../../app/src/gui/component_registry/bundle_components.ts)
as follows:

```typescript
registerField(
  'faims-custom', // namespace
  'AddressField', // component name
  'Address Field', // field name
  'Enter a valid street address', // field description
  'Geo', // category
  AddressField  // React Component
);
```

This call registers the new field. The register is indexed on the first two
arguments namespace and component name.  Note that the component name doesn't have
to be the same as the name of the React component but by convention it is.

(As it stands, the field name, description and category are not used since we 
refactored the form designer out of this app).

### Add the Field to Designer

To allow the field to be added to a new notebook it needs to be added to the
designer.   This has it's own register of field types (yes that's redundant) in
[fields.tsx](../../designer/src/fields.tsx).  The entry here is a prototype of the
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
to the component via the `props` argument.  Here is where you can add
configuration options if needed. You should include the standard
set of options shown here at a minimum.

If you have no additional options for your field then no more work is needed.
If there are extra options then you need to create component in the designer
to customise this field.  Look at eg. [MapFormFieldEditor.tsx](../../designer/src/components/Fields/MapFormFieldEditor.tsx) for an example.  The component will
probably extend the `BaseFieldEditor` component and add any extra options that
are needed.

### Create a Sample Notebook and Test

Now that the designer is configured to produce your new field you can create
a new notebook containing it and test it out in the app.

