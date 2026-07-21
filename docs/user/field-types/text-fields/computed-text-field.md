# Computed Text

_How to add and configure a Computed Text field in the {{Notebook}}
Editor._

---

## What This Field Does

A Computed Text derives text from an expression over other fields in the
same form — for example, joining a site code and plot number, or
classifying a measurement into 'Low' / 'Medium' / 'High'. The generated
value is read-only for data collectors; they see the result but cannot
edit it, and it updates automatically as the fields it references
change.

The field stays blank until every field its expression references has a
usable value, so a partially filled form shows no result rather than a
misleading one.

## Adding the Field

To add this field, open the
[ADD A FIELD dialog](../shared-settings/adding-a-field.md), navigate to the **TEXT**
tab, and click the **Computed Text** card. Then click the **ADD FIELD**
button in the lower right.

```{screenshot} field-types-design/computed-text-01-add-field.png
:alt: Adding a Computed Text — the TEXT tab in the ADD A FIELD dialog
:align: right
:width: 100%
```

## Configuring the Field

Click the field's **grey header bar** to expand it and see its settings.
For an overview of the settings shared by all fields — including Label,
Helper Text, Field ID, and the field toolbar — see
[Field Identity](../shared-settings/field-identity.md) and
[Field Toolbar](../shared-settings/field-toolbar.md).

Give the field a meaningful Label, review the auto-populated
Field ID, and add any desired Helper Text.

```{screenshot} field-types-design/computed-text-02-configured.png
:alt: Computed Text configuration in the {{Notebook}} Editor
:align: right
:width: 100%
```

### Computed Text-Specific Settings

The Computed Text's key feature is the **Expression** text area, which
defines the generated text. Each referenced field is written by wrapping
its Field ID in braces, and text is joined with the `&` operator, e.g.
`{Site-Code} & '-' & {Plot}`. Below the expression, a chip is shown for
each referenceable field in the form; clicking a chip inserts that
field's reference.

| Setting          | What It Does                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Expression**   | A text area where you define the generated text using literals, operators, and field references in single-brace syntax (e.g., `{Site-Code} & '-' & {Plot}`). |
| **Insert field** | A searchable picker of the referenceable fields in the form. Selecting one inserts its braced reference into the expression.                                 |

The expression is typed and checked when the {{notebook}} is designed —
mixing types is an error rather than a silent wrong answer. The overall
expression must produce **text**. The operators are:

- **Concatenation** (`&`) — joins text, e.g. `{Site-Code} & '-A'`.
- **Arithmetic** (`+ - * / %`) — numbers only (useful inside
  conditions).
- **Comparisons** (`< > <= >=`) — two numbers or two texts, producing
  true/false; equality (`==`, `!=`) requires matching types.
- **Logic** (`&&`, `||`, `!`) — true/false values only.
- **Conditionals** — a ternary `condition ? ifTrue : ifFalse`, with a
  true/false condition and same-typed branches. Ternaries can be nested
  to classify values, e.g.
  `{vegType} == 'hedge' ? ({vegHeight} < 3 ? 'Low' : 'High') : 'Medium'`.

Number and checkbox fields can be referenced anywhere in the
expression — only the final result must be text.

All referenced fields must be in the same form as the Computed Text. A
Computed Text cannot reference another computed field or a Templated
String. For record identifiers (HRIDs), use a
[Templated String](templated-string.md) instead.

### Shared Field Options

Configure any of the shared field options as needed.

For settings shared across all field types — including Annotation,
Uncertainty, Conditions, Copy value to new records, and Display in child
records — see
[Field Options](../shared-settings/field-options.md).

## Tips

- **Use the field picker to build expressions** rather than typing Field
  IDs by hand. Clicking a field inserts the exact braced reference, so you
  avoid typos and do not need to remember a field's ID.
- **Nest ternaries for classifications** — thresholds like
  Low/Medium/High are a natural fit, as in the example above.
- **The result stays blank until all referenced fields have values.**
  This is intentional — a partially complete record shows no value rather
  than a misleading partial calculation.
- **Computed Texts are read-only for data collectors.** They see the
  generated text but cannot edit it, keeping the value consistent with
  its inputs.
- **String comparisons are exact, including case.** `{vegType} == 'hedge'`
  will not match a value of `Hedge` — the expression takes the other branch
  with no error. When comparing against fixed values, prefer a Choice field
  for the input so the values are exact by construction.
