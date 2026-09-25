# Validation

## Overview

The validation module uses Zod schemas compiled from field specifications. It supports two strategies:

1. **Compiled Schema** - Pre-built schema for the entire form, efficient for repeated validation
2. **Per-Field Validation** - Individual field schemas, simpler but less efficient

```mermaid
flowchart TD
    subgraph "Schema Compilation"
        UI[UISpec] --> CSF[compileFormSchema]
        CSF --> FS[fieldSchemas per field]
        FS --> CS[Combined ZodObject]
    end

    subgraph "Validation"
        CS --> V[validate]
        FD[Form Data] --> V
        V --> VR[ValidationResult]
    end

    subgraph "Field Schema Source"
        FR[Field Registry] --> FSF[fieldDataSchemaFunction]
        FP[Field Props] --> FSF
        FSF --> FS
    end
```

## CompiledFormSchema

Pre-compiled schema for efficient validation:

```typescript
type CompiledFormSchema<T extends ZodRawShape = ZodRawShape> = {
  // Combined Zod schema
  schema: ZodObject<T>;
  // Individual field schemas
  fieldSchemas: Record<string, ZodTypeAny>;
  // Field IDs in schema
  fields: string[];
};
```

### Compilation

```typescript
const compiled = FormValidation.compileFormSchema({
  uiSpec: dataEngine.uiSpec,
  formId: 'site_form',
  config: {visibleBehaviour: 'include'},
});
```

### Configuration

```typescript
interface ValidationSettings {
  visibleBehaviour: 'include' | 'ignore';
}
```

| Setting   | Behaviour                                                      |
| --------- | -------------------------------------------------------------- |
| `include` | Validate all fields defined in form                            |
| `ignore`  | Validate only currently visible fields (requires `data` param) |

## Field Schema Generation

Each field provides a schema function:

```typescript
interface FieldInfo {
  fieldDataSchemaFunction?: (props: any) => z.ZodTypeAny;
}
```

The responsibility of this function is, given the uiSpec props for a field of that type, to return a Zod schema which validates a value for that field.

Missing values are coerced with `schemaWithAbsent` (see below) so a required check can run on an empty string, empty array, or `null` instead of failing as a type mismatch.

### Example: TextField

```typescript
const textFieldValueSchema = (props: BaseFieldParameters) => {
  let schema = z
    .string({error: 'Enter valid text'})
    .max(INPUT_LIMITS.LONG_TEXT_MAX_LENGTH, {
      message: `Must be at most ${INPUT_LIMITS.LONG_TEXT_MAX_LENGTH} characters`,
    });
  if (props.required) {
    schema = schema.min(1, {message: 'This field is required'});
  }
  return schemaWithAbsent('', schema);
};
```

### Example: RelatedRecord

```typescript
const valueSchemaFunction = (props: RelatedRecordFieldProps) => {
  const present = schemaWithAbsent(null, relatedFieldValueSchema.nullable());
  if (props.required) {
    return present.refine(
      val => (Array.isArray(val) ? val.length > 0 : !!val),
      {message: 'At least one related record is required.'}
    );
  }
  return present;
};
```

### Example: FileUploader

```typescript
const fileUploaderSchemaFunction = (props: FileUploaderProps) => {
  const maxFiles = props.maximum_number_of_files ?? 0;
  let base = z.array(z.string(), {error: 'Add a valid file'});
  if (props.required) {
    base = base.min(1, {message: 'At least one attachment is required'});
  }
  if (maxFiles > 0) {
    base = base.max(maxFiles, {
      message: `Maximum ${maxFiles} file${maxFiles === 1 ? '' : 's'} allowed`,
    });
  }
  return schemaWithAbsent([], base);
};
```

## Absent values and readable messages

`schemaWithAbsent(empty, schema)` in `readableErrors.ts` turns `null` and `undefined` into `empty` before the field schema runs. Text uses `''`, attachment ids use `[]`, and related records use `null`. A bare `z.string()` or `z.array()` would otherwise report "expected … received undefined" and never reach `.min()` or `.refine()`. Other wrong types are left unchanged.

`humanizeValidationMessage` rewrites leftover Zod type text into a sentence a respondent can act on. Messages a field already set are kept. `FormValidation` applies this to issue messages. The form manager uses `collectFieldErrorMessages` to store the first humanized message against each field id. Nested paths such as `photos.0` are reported on the field itself.

## Validation Modes

EditableFormManager uses different modes based on record state:

```typescript
type ValidationMode = 'FULL' | 'ONLY_TOUCHED';

const validationMode: ValidationMode =
  props.mode === 'new' ? 'ONLY_TOUCHED' : 'FULL';
```

| Mode           | Behaviour                                     | Use Case         |
| -------------- | --------------------------------------------- | ---------------- |
| `FULL`         | Validate all visible fields                   | Existing records |
| `ONLY_TOUCHED` | Validate only fields user has interacted with | New records      |

### Filtering for Touched Fields

```typescript
const filtered = FormValidation.filterCompiledSchema({
  compiledSchema: compiled,
  fieldIds: touchedFieldIds,
});
```

## Schema Recompilation

When field visibility changes, schemas can be incrementally updated:

```typescript
type RecompiledFormSchema = CompiledFormSchema & {
  addedFields: string[];
  removedFields: string[];
  reusedFields: string[];
};

const recompiled = FormValidation.recompileFormSchema({
  previousSchema: compiled,
  uiSpec,
  formId,
  data: currentValues,
  config,
});
```

## Validation Result

```typescript
interface ValidationResult {
  valid: boolean;
  errors: Record<string, string[]>;
  fieldResults: Record<string, FieldValidationResult>;
}

interface FieldValidationResult {
  valid: boolean;
  errors: string[];
}
```

## Integration with TanStack Form

Validation runs on form changes via TanStack Form's onChange:

```typescript
const form = useForm({
  defaultValues: initialData,
  validators: {
    onChange: ({value}) => {
      const result = FormValidation.validateFormData({
        schema: validationSchema.current,
        data: value,
        mode: validationMode,
        touchedFields: Array.from(touchedFields),
      });

      return result.valid ? undefined : result.errors;
    },
  },
});
```

## Error Display

Errors flow from validation to field components via state:

```typescript
// In field component
const errors = props.state.meta.errors as unknown as string[];

// FieldWrapper displays errors
<FieldWrapper heading={label} errors={errors}>
  {children}
</FieldWrapper>;
```

### FieldWrapper Error UI

- Red border with subtle glow
- Error icon with message
- Multiple errors shown as list

## Validation Timing

```mermaid
sequenceDiagram
    participant U as User
    participant FC as Field Component
    participant TF as TanStack Form
    participant V as Validation
    participant FW as FieldWrapper

    U->>FC: onChange
    FC->>TF: setFieldData(value)
    TF->>V: validators.onChange
    V->>V: Compile/filter schema
    V->>V: Validate against schema
    V-->>TF: errors or undefined
    TF-->>FC: state.meta.errors
    FC->>FW: errors prop
    FW->>FW: Render error UI
```

## FormValidation API

```typescript
const FormValidation = {
  compileFormSchema(params): CompiledFormSchema,

  filterCompiledSchema(params): CompiledFormSchema,

  recompileFormSchema(params): RecompiledFormSchema,

  getFieldSchema(params): ZodTypeAny | undefined,

  validateFormData(params): ValidationResult,

  validateField(params): FieldValidationResult,

  getRelevantFields(params): string[],
};
```

## Default Settings

```typescript
const DEFAULT_VALIDATION_SETTINGS: ValidationSettings = {
  visibleBehaviour: 'ignore',
};
```

With `'ignore'`, only currently visible fields are validated. This requires passing current form data to determine visibility.

## Props Schema Validation

Separate from data validation, field props can be validated against their schema:

```typescript
interface FieldInfo {
  fieldPropsSchema?: z.ZodTypeAny;
}

// Example (BaseFieldParametersSchema is imported from @faims3/data-model)
const textFieldPropsSchema = BaseFieldParametersSchema.extend({
  multiline: z.boolean().optional(),
  InputProps: z
    .object({
      type: z.string().optional(),
    })
    .optional(),
});
```

This validates UISpec field definitions at load time, catching configuration errors early.
