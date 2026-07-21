# Computed Number

_How to add and configure a Computed Number field in the {{Notebook}}
Editor._

---

## What This Field Does

A Computed Number derives a number from an expression over other fields
in the same form — for example, multiplying a mass field by a count, or
averaging two measurements. The generated value is read-only for data
collectors; they see the result but cannot edit it, and it updates
automatically as the fields it references change.

The field stays blank until every field its expression references has a
usable value, so a partially filled form shows no result rather than a
misleading one.

## Adding the Field

To add this field, open the
[ADD A FIELD dialog](../shared-settings/adding-a-field.md), navigate to the **NUMBERS**
tab, and click the **Computed Number** card. Then click the **ADD FIELD**
button in the lower right.

```{screenshot} field-types-design/computed-number-01-add-field.png
:alt: Adding a Computed Number — the NUMBERS tab in the ADD A FIELD dialog
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

```{screenshot} field-types-design/computed-number-02-configured.png
:alt: Computed Number configuration in the {{Notebook}} Editor
:align: right
:width: 100%
```

### Computed Number-Specific Settings

The Computed Number's key feature is the **Expression** text area, which
defines the calculated value. Each referenced field is written by
wrapping its Field ID in braces, e.g.
`{Wet-Soil-Mass-g} * {Number-of-Samples}`. Below the expression, a chip
is shown for each referenceable field in the form; clicking a chip
inserts that field's reference, which avoids typing the Field ID by
hand.

| Setting          | What It Does                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Expression**   | A text area where you define the calculation using literals, operators, and field references in single-brace syntax (e.g., `{Width} * {Height}`). |
| **Insert field** | A searchable picker of the referenceable fields in the form. Selecting one inserts its braced reference into the expression.                      |

The expression is typed and checked when the {{notebook}} is designed —
mixing types is an error rather than a silent wrong answer. The overall
expression must produce a **number**. The operators are:

- **Arithmetic** (`+ - * / %`) — numbers only, with parentheses and a
  leading minus.
- **Concatenation** (`&`) — text only (useful inside conditions).
- **Comparisons** (`< > <= >=`) — two numbers or two texts, producing
  true/false; equality (`==`, `!=`) requires matching types.
- **Logic** (`&&`, `||`, `!`) — true/false values only.
- **Conditionals** — a ternary `condition ? ifTrue : ifFalse`, e.g.
  `{Depth} > 0 ? {Depth} * 12 : 0`. The condition must be true/false and
  both branches must have the same type.

Text and checkbox fields can be referenced anywhere in the expression —
only the final result must be a number. For example,
`{vegType} == 'plot' ? 3 : 5` is a valid Computed Number.

All referenced fields must be in the same form as the Computed Number. A
Computed Number cannot reference another computed field or a Templated
String.

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
- **The result stays blank until all referenced fields have values.**
  This is intentional — a partially complete record shows no value rather
  than a misleading partial calculation.
- **Type mismatches are reported when the {{notebook}} is designed**, not
  hidden at data-collection time — if an expression mixes types (e.g.
  multiplying a text field), fix it in the Editor before publishing.
- **Computed Numbers are read-only for data collectors.** They see the
  calculated result but cannot edit it, keeping the value consistent with
  its inputs.
