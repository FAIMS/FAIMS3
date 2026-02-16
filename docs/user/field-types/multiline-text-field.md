# Multi-line Text Field

*How to add and configure a Multi-line Text Field in the Notebook Editor.*

---

## What This Field Does

A Multiline Text Field provides an extended text area for narrative
content, detailed observations, and descriptive passages. Unlike the
single-line FAIMS Text Field, it supports multiple lines with internal
scrolling, making it suitable for entries that commonly exceed a
sentence or two — such as context descriptions, condition assessments,
and interpretative notes.

## Adding the Field

To add this field, open the
[ADD A FIELD dialog](adding-a-field.md), navigate to the **TEXT**
tab, and click the **Multiline Text Field** card. Then click the
**ADD FIELD** button in the lower right.

```{screenshot} field-types-design/multiline-text-field-01-add-field.png
:alt: Adding a Multiline Text Field — the TEXT tab in the ADD A FIELD dialog
:align: right
:width: 100%
```

## Configuring the Field

Click the field's **grey header bar** to expand it and see its settings.
For an overview of the settings shared by all fields — including Label,
Helper Text, Field ID, and the field toolbar — see
[Field Identity](field-identity.md) and
[Field Toolbar](field-toolbar.md).

Give the field a meaningful Label, review the auto-populated
Field ID, and add any desired Helper Text.

```{screenshot} field-types-design/multiline-text-field-02-configured.png
:alt: Multiline Text Field configuration in the {{Notebook}} Editor
:align: right
:width: 100%
```

### Multiline Text Field-Specific Settings

| Setting | What It Does |
| ------- | ------------ |
| **Rows to display** | The number of visible text rows in the field. Controls the initial height of the text area — collectors can still type beyond this limit and scroll within the field. |

### Shared Field Options

Configure any of the shared field options as needed.

For settings shared across all field types — including Required,
Annotation, Uncertainty, Conditions, Copy value to new records,
and Display in child records — see
[Field Options](field-options.md).

> **Note:** Below the shared options, this field includes a
> **Speech-to-Text Settings** section. When enabled, collectors can
> use voice-to-text input for this field during data collection. An
> additional option lets you append dictated text to existing content
> instead of replacing it.

## Tips

- **Designed for extended narrative.** Use this field for context
  descriptions, condition assessments, and detailed observations.
  For short entries under about 50 characters (codes, identifiers,
  brief labels), use FAIMS Text Field instead.
- **On mobile, the touch keyboard can obscure the text area.** Place
  sections with multiline fields towards the end of a form so
  collectors can review earlier entries before writing descriptions.
- **Content is plain text only** — the field preserves line breaks,
  tabs, and spaces, but no rich text formatting is available. The
  Enter key creates new lines rather than submitting the form.
- **Enable Annotation** for multiline fields where the main
  text might need a qualifying note (e.g., "artefact
  analysis based on in-field observation only").
