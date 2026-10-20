# Field Specification

## Overview

Fields in the UISpec are defined using `FieldDefinition`. This schema determines which component renders and how it behaves. It is the canonical field shape and lives in `@faims3/data-model` (`uiSpecification/types.ts`).

## FieldDefinition Schema

The `uiSpec.fields` object key is the immutable storage id. `exportName` is the
editable CSV / GIS column (required since notebook schema `1.0.1`).

```typescript
// @faims3/data-model (schema 1.0.1; FieldDefinitionSchema)
const fieldDefinitionV1_0_1Shape = {
  'component-namespace': z.string(),
  'component-name': z.string(),
  'type-returned': z.string(),
  // base parameters common to all fields, with any per-field-type parameters
  // passed through unmodelled (validated precisely in the forms layer via each
  // field's `fieldPropsSchema`)
  'component-parameters': BaseFieldParametersSchema.loose(),
  // editable CSV / GIS column; distinct from the `uiSpec.fields` storage id
  exportName: z.string().min(1),
  initialValue: z.any().optional(),
  persistent: z.boolean().optional(),
  meta: FieldMetaSchema.optional(),
  // Conditional visibility logic (raw, serializable expression)
  condition: ConditionalExpressionSchema.nullable().optional(),
};

// unmodelled keys (e.g. designer authoring metadata) survive a round-trip
export const FieldDefinitionSchema = z
  .object(fieldDefinitionV1_0_1Shape)
  .loose();
export type FieldDefinition = z.infer<
  z.ZodObject<typeof fieldDefinitionV1_0_1Shape>
>;
```

### Standard vs compiled

Following the same pattern as views, the raw `condition` expression is compiled
at runtime into a callable `conditionFn`. That non-serializable function lives on
`CompiledFieldDefinition` (`CompiledFieldDefinitionSchema`) rather than on the
base `FieldDefinition`, so the serializable shape stays clean:

```typescript
// @faims3/data-model
export const CompiledFieldDefinitionSchema = z
  .object({
    ...fieldDefinitionV1_0_1Shape,
    // attached at runtime by `compileUiSpecConditionals`
    conditionFn: z.custom<(v: RecordValues) => boolean>().optional(),
  })
  .loose();
```

> The exported `FieldDefinition` **type** is derived from the strict (non-
> loose) shape so it has no `[k: string]: unknown` index signature. That
> keeps it composable with `Omit`/intersection downstream (e.g. the designer
> overriding `component-parameters`), while the **schema** still passes
> unmodelled keys through at runtime.

## Field Resolution

The `component-namespace` and `component-name` are used to lookup the field in the registry:

```typescript
// Field.tsx
const fieldInfo = getFieldInfo({
  namespace: fieldSpec['component-namespace'],
  name: fieldSpec['component-name'],
});
```

Registry key format: `{namespace}::{name}`

Example: `faims-custom::RelatedRecordSelector`

## Component Parameters

The `component-parameters` object is spread directly into the field component:

```typescript
<Component
  {...(fieldSpec['component-parameters'] as BaseFieldParameters)}
  state={field.state}
  config={props.config}
  // ... other injected props
/>
```

### Common Parameters

All fields support base parameters:

| Parameter            | Type      | Description                                                         |
| -------------------- | --------- | ------------------------------------------------------------------- |
| `name`               | `string`  | **Required.** Storage id; must match the `uiSpec.fields` object key |
| `label`              | `string`  | Display label                                                       |
| `helperText`         | `string`  | Short help text below label                                         |
| `advancedHelperText` | `string`  | Extended help (markdown, opens dialog)                              |
| `required`           | `boolean` | Validation: field must have value                                   |
| `disabled`           | `boolean` | Prevent editing                                                     |

### Field-Specific Parameters

Each field type defines additional parameters. See examples below.

## Initial Value

The `initialValue` property sets the field's default state when creating new records:

```json
{
  "component-namespace": "faims-custom",
  "component-name": "FAIMSTextField",
  "component-parameters": {"name": "f_a1b2c3", "label": "Description"},
  "exportName": "Description",
  "initialValue": ""
}
```

For complex fields:

```json
{
  "component-namespace": "faims-custom",
  "component-name": "MultiSelect",
  "component-parameters": { ... },
  "exportName": "Site-Hazards",
  "initialValue": []
}
```

## Meta Configuration

```typescript
// @faims3/data-model
const FieldMetaSchema = z.object({
  annotation: z.object({
    include: z.boolean(),
    label: z.string(),
  }),
  uncertainty: z.object({
    include: z.boolean(),
    label: z.string(),
  }),
});
```

### Annotation

Enables user annotation input for the field:

```json
"meta": {
  "annotation": {
    "include": true,
    "label": "Notes"
  }
}
```

When enabled, renders additional input below field for user notes.

### Uncertainty

Enables uncertainty flag for field value:

```json
"meta": {
  "uncertainty": {
    "include": true,
    "label": "Uncertain"
  }
}
```

## Example Field Specifications

### MapFormField

```json
"f_c3d4e5": {
    "component-namespace": "mapping-plugin",
    "component-name": "MapFormField",
    "type-returned": "faims-core::JSON",
    "exportName": "Site-Location",
    "component-parameters": {
        "name": "f_c3d4e5",
        "id": "map-form-field",
        "variant": "outlined",
        "required": true,
        "featureType": "Point",
        "zoom": 18,
        "label": "Site Location",
        "geoTiff": "",
        "helperText": "Enter the location of the site",
        "protection": "none"
    },
    "initialValue": "",
    "meta": {
        "annotation": {
            "include": false,
            "label": "annotation"
        },
        "uncertainty": {
            "include": false,
            "label": "uncertainty"
        }
    },
    "persistent": false,
},
```

### Select

```json
"f_d4e5f6": {
    "component-namespace": "faims-custom",
    "component-name": "MultiSelect",
    "type-returned": "faims-core::Array",
    "exportName": "Site-Hazards",
    "component-parameters": {
        "label": "Site Hazards",
        "fullWidth": true,
        "helperText": "",
        "variant": "outlined",
        "required": true,
        "select": true,
        "SelectProps": {
            "multiple": true
        },
        "ElementProps": {
            "options": [
                {
                    "label": "Hazard 1",
                    "value": "Hazard 1"
                },
                // ...
            ],
            "exclusiveOptions": [
                "None "
            ],
            "expandedChecklist": true
        },
        "name": "f_d4e5f6",
        "protection": "none"
    },
    "initialValue": [],
    "meta": {
        "annotation": {
            "include": false,
            "label": "annotation"
        },
        "uncertainty": {
            "include": false,
            "label": "uncertainty"
        }
    },
    "persistent": false,
},
```

## Conditional Visibility

Fields can be conditionally shown based on other field values. This is configured in the UISpec's visibility rules (outside `component-parameters`).

The form system evaluates visibility and passes `fieldVisibilityMap` to renderers:

```typescript
type FieldVisibilityMap = Record<string, string[]>;
// Maps section ID to list of visible field IDs
```

## Hidden Fields

To hide a field from display while keeping it in the data model:

```json
{
  "component-parameters": {
    "name": "f_e5f6a7",
    "hidden": true
  },
  "exportName": "internal_id"
}
```

Hidden fields:

- Are not rendered in edit mode
- Are not rendered in view mode
- Still participate in data model
- Can be set programmatically (e.g., via templated fields)
