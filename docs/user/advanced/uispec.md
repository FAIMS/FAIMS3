(advanced/uispec)=
# UI Specification

UI specification is stored in CouchDB and has the following format:

```
{
    "_id": "couchdb identifier",
    "_rev": "couchdb revision",
    "fields": "array of field specifications",
    "fviews": "array of views",
    "viewsets": "array of view sets",
    "visible_types": "array of visible types",
};
```

`_id` and `_rev` are internal CouchDB fields.

## Fields

The `fields` property is an array of field specifications. Each field has an
identifier unique in the form.  The notebook builder uses the format `newfield + XXX`
where `XXX` is a random hex string; there is no meaning to this format so could
be something more intuitive (takepoint1).

```
"newfield5363dcf4": {
    "component-namespace": "faims-custom",
    "component-name": "TakePoint",
    "type-returned": "faims-pos::Location",
    "component-parameters": {},
    "validationSchema": [],
    "is_logic": {},
    "initialValue": null,
    "access": [],
    "meta": {}
}
```

### Component Namespace

Almost always has the value `'faims-custom'` except for the mapping and qrcode fields.
Used along with the component name in the function `getComponentByName` to lookup the
chosen component.

### Component Name

The component name for this form field.  Used to select the component to use
when displaying the form field.  This component name needs to have been
registered with `registerComponent` in `src/gui/component_registry/bundle_components.ts`.

### Type Returned

The type of data returned by the form field.  Comment in code says "matches
a type in the Project Model"   Not clear that this is used in the
FAIMS code.  Note that this field is spelled in the code in some places as `type-return`.  May not be used in the code.  Observed values:

* `faims-core::String`
* `faims-core::Integer`
* `faims-core::Bool`
* `faims-core::JSON` (map field)
* `faims-core::Json` (advanced select)
* `faims-core::Child`
* `faims-core::Linked`
* `faims-core::Array`

### Component Parameters

```json
{
    "fullWidth": true,
    "name": "newfield5363dcf4",
    "id": "newfield5363dcf4",
    "helperText": "Tap to select the starting point for the survey.",
    "variant": "outlined",
    "label": "Take GPS Starting Point"
}
```

```json
{
    "fullWidth": true,
    "helperText": "Select your campus area from the list. (For other, use annotation icon)",
    "variant": "outlined",
    "required": false,
    "select": true,
    "InputProps": {},
    "SelectProps": {},
    "ElementProps": {
        "options": [
        {
            "value": "Zone Alpha; ",
            "label": "Zone Alpha; "
        },
        {
            "value": "Zone Beta; ",
            "label": "Zone Beta; "
        },
        {
            "value": "Zone Charlie; ",
            "label": "Zone Charlie; "
        },
        {
            "value": "Zone Delta; ",
            "label": "Zone Delta; "
        },
        {
            "value": "Zone Other; ",
            "label": "Zone Other; "
        }
        ]
    },
    "InputLabelProps": {
        "label": "Campus Zone"
    },
    "id": "newfield800c3f33",
    "name": "newfield800c3f33"
},
```

### Validation Schema

This is passed in to Formik to use for validation of the field value.

```json
[
        [
          "yup.object"
        ],
        [
          "yup.nullable"
        ]
]
```

### Is Logic

```json
{
    "newfield800c3f33": [
        "Zone Alpha; ",
        "Zone Charlie; "
    ]
}
```

### Access

```json
[
    "admin"
]
```

### Meta

```json
{
    "annotation_label": "annotation",
    "annotation": false,
    "uncertainty": {
        "include": false,
        "label": "uncertainty"
    }
}
```

### List of registered Form components

Showing namespace and component-name.

* core-material-ui Input
* core-material-ui Checkbox
* core-material-ui TextField
* formik-material-ui TextField
* formik-material-ui Select
* formik-material-ui RadioGroup
* faims-custom Select
* faims-custom MultiSelect
* faims-custom AdvancedSelect
* faims-custom Checkbox
* faims-custom RadioGroup
* faims-custom ActionButton
* faims-custom TakePoint
* faims-custom TakePhoto
* faims-custom TemplatedStringField
* faims-custom BasicAutoIncrementer
* faims-custom RelatedRecordSelector
* qrcode QRCodeFormField
* mapping-plugin MapFormField
* formik-material-ui MultipleTextField
* faims-custom FileUploader
* faims-custom RandomStyle
* faims-custom DateTimeNow
