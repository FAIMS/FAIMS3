# Forms Module Documentation

Technical documentation for the FAIMS3 Forms Module.

The FAIMS3 forms module has been completely re-written, and strongly utilises
the data engine, and attachment services, which are part of the `data-model`
package. Efforts have been made to keep an interface layer between the data
engine, attachment engine, and the actual form/field implementations.

## Quick start - adding a new field

For a quick guide on how to create a new field, see [Quickstart: add a new field](./quickstart.md).

## Contents

### Architecture

| Document                                                   | Description                                          |
| ---------------------------------------------------------- | ---------------------------------------------------- |
| [01-overview.md](./01-overview.md)                         | Module structure, dependencies, data flow            |
| [02-form-managers.md](./02-form-managers.md)               | FormManager, EditableFormManager, PreviewFormManager |
| [03-form-vs-view-engine.md](./03-form-vs-view-engine.md)   | Edit mode vs read-only rendering                     |
| [04-dependency-injection.md](./04-dependency-injection.md) | DataEngine, AttachmentService, Navigation            |

### Field System

| Document                                   | Description                       |
| ------------------------------------------ | --------------------------------- |
| [05-field-system.md](./05-field-system.md) | Field registry, adding new fields |
| [06-field-spec.md](./06-field-spec.md)     | UISpec field configuration        |
| [07-validation.md](./07-validation.md)     | Zod schemas, validation modes     |

### Special Fields

| Document                                                                     | Description            |
| ---------------------------------------------------------------------------- | ---------------------- |
| [08-special-fields/related-record.md](./08-special-fields/related-record.md) | RelatedRecordSelector  |
| [08-special-fields/take-photo.md](./08-special-fields/take-photo.md)         | TakePhoto camera field |
| [08-special-fields/file-uploader.md](./08-special-fields/file-uploader.md)   | FileUploader           |

### Layout and navigation

| Document                               | Description                                            |
| -------------------------------------- | ------------------------------------------------------ |
| [09-sections.md](./09-sections.md)     | TabbedSections, InlineSections                         |
| [10-navigation.md](./10-navigation.md) | Explicit vs implied navigation, breadcrumbs, callbacks |

## Quick Reference

### Adding a New Field

See [05-field-system.md](./05-field-system.md) for detailed instructions.

1. Create field directory: `library/forms/lib/fieldRegistry/fields/MyField/`
2. Define props schema extending `BaseFieldPropsSchema`
3. Implement edit component using `FieldWrapper`
4. Implement view component
5. Create `FieldInfo` export with validation schema function
6. Register in `registry.ts`
