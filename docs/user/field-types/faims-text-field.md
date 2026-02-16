# FAIMS Text Field

*How to add and configure a FAIMS Text Field in the Notebook Editor.*

---

## What This Field Does

A FAIMS Text Field provides a single-line input for brief, unconstrained
text. It is the primary choice for codes, identifiers, short labels,
and other short-form text — typically accommodating around 50 characters.

## Adding the Field

To add this field, open the
[ADD A FIELD dialog](adding-a-field.md), navigate to the **TEXT**
tab, and click the **FAIMS Text Field** card. Then click the **ADD FIELD**
button in the lower right.

```{screenshot} field-types-design/faims-text-field-01-add-field.png
:alt: Adding a FAIMS Text Field — the TEXT tab in the ADD A FIELD dialog
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

```{screenshot} field-types-design/faims-text-field-02-configured.png
:alt: FAIMS Text Field configuration in the {{Notebook}} Editor
:align: right
:width: 100%
```

### Shared Field Options

Configure any of the shared field options as needed.

For settings shared across all field types — including Required,
Annotation, Uncertainty, Conditions, Copy value to new records,
and Display in child records — see
[Field Options](field-options.md).

> **Note:** Below the shared options, this field includes a **Speech-to-Text
> Settings** section. When enabled, collectors can use voice-to-text input
> for this field during data collection. An additional option lets you append
> dictated text to existing content instead of replacing it.

## Tips

- **Use with caution.** In many — if not most — cases, fields
  with controlled lists (e.g., Choice fields) will produce more
  consistent data with fewer errors. Fields with pre-populated
  options are also faster to complete in the field.
- **Best for entries under about 50 characters.** For longer text
  (descriptions, narratives), use Multi-line Text Field instead.
- **Enable Speech-to-Text** for fields where collectors may be working
  hands-free or in wet/dirty conditions.
- **Review the Field ID before saving** — it is auto-generated from the
  Label. Once records exist, changing the Field ID can break data continuity.
- **Use for metadata.** One valuable use of free-text fields is
  to capture record-level metadata — information about the data
  collected in the record, such as unexpected environmental
  conditions or unanticipated challenges. Such use complements
  Annotations (field-level metadata) and {{Notebook}} Details
  (project-level metadata).
