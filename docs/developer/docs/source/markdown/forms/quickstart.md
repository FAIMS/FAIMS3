# Adding Fields Types to FAIMS

This document describes the requirements for adding a new field type to the FAIMS
app.

The form manager (FormManager) and individual field components are defined in the
`library/forms` module in the project as a separate module that can be used in both
the mobile app (for data entry) and the form designer (for form preview).

## How Fields Come to Be

The forms presented by the app are defined in the JSON UI Specification which is
part of the JSON notebook definition/schema file (along with the notebook
metadata). The UI specification defines a list of fields. Each field is a chunk
of JSON that defines the type of the field and any option settings for this
particular instance.

A FAIMS field is defined in the `forms` module as a `FieldSpec` and consists of
the following parts:

- `namespace`: this is the `component-namespace` property from the UI spec e.g.
  `faims-custom`
- `name`: The field name (from UI spec)
- `component`: a component that renders the field and captures user data
- `view`: a component that takes a collected value of that type, and displays it
  in a concise, read only way - this may be as simple as just returning a
  `<Typography>{value}</Typography>` element
- `fieldPropsSchema`: a Zod schema for the properties of the field from the UI
  spec - i.e. the `component-props` part of the ui spec
- `fieldDataSchemaFunction`: a function which takes the props from the UI spec
  and returns a zod model which can validate a value that this field collects
  during form validation

This component is registered with the app and the rest happens automatically as
long as the component does the right things.

## Adding a New Field Type

Here is the overall process and requirements for a new field.

### Define the Component Props Schema

The field is configured with a set of properties that will be part of the field
definition in the JSON UISpec. There is a base set of properties defined as
`BaseFieldPropsSchema`:

```typescript
export const BaseFieldPropsSchema = z.object({
  label: z.string().optional(),
  name: z.string(),
  helperText: z.string().optional(),
  required: z.boolean().optional(),
  advancedHelperText: z.string().optional(),
  disabled: z.boolean().optional(),
});
```

that includes the field name, label, required and disabled flags and helper text
settings.

If your new field has no special settings then you can use this schema directly
(and it's associated type `BaseFieldProps`). Otherwise you would extend this
schema with your new options. For example, the select field adds a list of
options:

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
const Select = (props: SelectFieldProps & FullFieldProps)
```

`FullFieldProps` includes additional properties that help control the form
field behaviour, i.e.

```typescript
// These are the additional FaimsForm props passed
export type FormFieldContextProps = {
  // Which field is being rendered?
  fieldId: string;
  // The current value of this field (data, annotations, attachments)
  state: FaimsFormFieldState;
  // This fields data setting function
  setFieldData: (value: any) => void;
  // This fields annotation setting function
  setFieldAnnotation: (value: FormAnnotation) => void;
  // Add new attachment (at start of attachment list)
  addAttachment: (params: {
    blob: Blob;
    contentType: string;
    type: 'photo' | 'file';
    fileFormat: string;
  }) => Promise<string>;
  // Delete an attachment with given ID
  removeAttachment: (params: {attachmentId: string}) => Promise<void>;
  // If you want blur functionality to work - add to onBlur handlers
  handleBlur: () => void;
  // Additional deeper configuration
  config: FormConfig;
  /** Special behavior triggers */
  trigger: {
    /** Force a commit/save of the current record */
    commit: () => Promise<void>;
  };
};
```

The current value of the field can be found in `props.state.value`, this is of
type `FormDataEntry` and contains properties for the `data`, `annotations` and
`attachments`. Note that this might be undefined and the `data` property will
have unknown type so you will want to use something like this to get the current
field value:

```typescript
const value = (props.state.value?.data as string) || '';
```

The main requirement on the component is to use the callback functions when a
new value for the field is available. `props.setFieldData` will update the data
part of the state. For example, in the Address field:

```typescript
const setFieldValue = (a: AddressType) => {
  const dn = `${a.house_number || ''} ${a.road || ''}, ${a.suburb || ''}, ${
    a.state || ''
  } ${a.postcode || ''}`;
  setDisplayName(dn);
  setAddress(a);
  props.setFieldData({
    display_name: dn,
    address: a,
  });
};
```

Note that the value that the field generates can be anything from a simple
string to an object. In this case we generate a fragment of a GeocodeJSON object
containing the address data.

The call to `props.setFieldData` etc updates the current record with the new
data.

The component can handle any interaction locally. For example, it can show/hide
an edit form when the user clicks the edit icon; the map field pops up a map
overlay to capture map input. As long as the behaviour interacts well with the
overall UI, anything is possible here.

### Define the view component

When viewing record data, FAIMS will show a custom read-only rendering of this data. Fields must supply a component which performs this rendering. The basic responsibility of this component is to visualise the data, in whichever way is most suitable.

#### Typing

The following type

```typescript
export type DataViewFieldRender = React.FC<DataViewFieldRenderProps>;
```

is available to type your rendering component e.g.

```typescript
export const YourCustomRenderer: DataViewFieldRender = props => {
  return <p>TODO</p>;
};
```

You can view the full specification in this type:

```typescript
export type DataViewFieldRenderContext = {
  // The viewsetId
  viewsetId: string;
  // The view/section ID
  viewId: string;
  // The field name/ID
  fieldId: string;
  // The record HRID
  hrid: string;
  // The full RecordMetadata object, which may help with more advanced types
  record: HydratedRecordDocument;
  // UI specification
  uiSpecification: ProjectUIModel;
  // The form render trace (to help build new entries)
  trace: DataViewTraceEntry[];
  // Controls/triggers
  tools: DataViewTools;
  // The full form data if needed
  formData: FormUpdateData;
  // Name and namespace
  fieldName: string;
  fieldNamespace: string;
};
```

#### The DefaultRenderer

A DefaultRenderer is available for use, which simplifies `JSON` stringifies the data, then shows this as a simple text element.

#### Simple text field example

```typescript
export const textFieldSpec: FieldInfo = {
  //...
  view: {component: DefaultRenderer, config: {}},
};
```

#### Complex FileUploader example

The file uploader needs to make use of the available tools in the render
function. You should not need to call out to outside contexts (e.g. Redux) - all
tools/context needed are available in the render props.

```typescript
export const fileUploaderFieldSpec: FieldInfo<FileUploaderFieldProps> = {
  //...
  view: {
    component: FileUploaderRender,
    config: {},
    attributes: {singleColumn: false},
  },
};
```

And with some omissions made:

```typescript
export const FileUploaderRender: DataViewFieldRender = props => {
  // Get attachment service from render context
  const attachmentService = useMemo(() => {
    return props.renderContext.tools.getAttachmentService();
  }, [props.renderContext.tools]);

  // Load all attachments for this field
  const attachments = useAttachments(
    (props.attachments ?? []).map(a => a.attachmentId),
    attachmentService
  );

  // ... (various processing/filtering)

  return (
    <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 2}}>
      {/* Render image attachments as thumbnails */}
      {attachments.map((att, idx) => (
        <ImageAttachment
          key={`img-${att.metadata.filename}-${idx}`}
          url={att.url}
          filename={att.metadata.filename}
          index={idx}
        />
      ))}
    </Box>
  );
};
```

### Define a Value Schema Function

Each field also defines a function that can be used to validate the value of the
field by returning a zod schema for the value based on the field properties. The
select field generates a schema that includes all of the select options as
alternatives:

```typescript
const valueSchema = (props: SelectFieldProps) => {
  const optionValues = props.ElementProps.options.map(option => option.value);
  return z.union(optionValues.map(val => z.literal(val)));
};
```

### Export the FieldInfo Object

The full definition of the field is contained in an instance of `FieldInfo` that
should be exported from your field module. This contains the following:

```typescript
export const selectFieldSpec: FieldInfo<FieldProps> = {
  namespace: 'faims-custom',
  name: 'Select',
  returns: 'faims-core::String',
  component: Select,
  fieldPropsSchema: SelectFieldPropsSchema,
  fieldDataSchemaFunction: valueSchema,
  view: {component: DefaultRenderer, config: {}},
};
```

Note: `FieldInfo<FieldProps>` this generic type informs the type system what
kind of props the component expects. It has the `BaseFieldProps` default type,
but you can provide better typing by using the more specific type - i.e. your
custom props type as above.

The field namespace and name are used to select this field from the UISpec, they
should be unique in combination in the system. Generally the namespace would be
`faims-custom` until we have a good reason to use something else (some old
fields use the `formik-material-ui` namespace but these may well be deprecated,
the mapping and QR code fields have their own namespace because Steve didn't
understand namespaces when he wrote them).

The `returns` property defines the return type of the field and should be one of
the values defined in `FieldReturnType` in the forms module. We don't currently
make much use of this and it might be superseded by the
`fieldDataSchemaFunction`.

### Register the Field

Each field must be registered in the `lib/fieldRegistry/registry.ts` module. This is done
just by importing the relevant FieldInfo instance and adding it to the field list:

```typescript
import {selectFieldSpec} from './fields/SelectField';

const FieldSpecList: FieldInfo<FullFieldProps & any>[] = [
  // ... other fields,
  selectFieldSpec,
];
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
