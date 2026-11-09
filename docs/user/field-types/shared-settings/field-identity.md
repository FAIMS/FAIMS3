# Field Identity

_The Field Heading, Helper Text, and Export Title that every field shares._

---

## Overview

When you expand a field by clicking its grey header bar, you will see the
field's type badge (e.g., "FAIMSTextField"), its Helper Text preview in
italic, and the toolbar icons. Below that, the first panel contains
two identity inputs ("Field Heading" and "Export Title") plus a "Helper Text"
input field. The Field Heading is what collectors see. The Export Title is the
column header in CSV and GIS exports. Helper Text allows you to provide
guidance to data collectors using the {{notebook}}.

```{screenshot} field-types-design/shared-03-field-identity.png
:alt: Field identity panel showing Field Heading, Helper Text, and Export Title for the Feature description field
:align: right
:width: 100%
```

## Field Heading

The **Field Heading** is the display name shown above the field during data
collection.

**Choose a field heading that is short, descriptive, and unambiguous.** Good
field headings read naturally on a phone — for example, "Feature type", "Soil
colour", or "Artefact count".

Changing the Field Heading does not change stored data or export column names.

## Export Title

The **Export Title** is the column header used when you export data to
CSV or GIS. When you type a Field Heading on a new field, the Export Title
auto-generates by converting spaces to hyphens — for example,
"Feature description" becomes `Feature-description`. The original
capitalisation is preserved.

You can **edit the Export Title directly** if you need a different
column. It must be unique within the {{notebook}}. Changing it does
**not** affect collected values; it only changes the header in future
exports.

Each field also has an internal storage id (minted when the field is
created) that never changes. You do not need to edit it.

## Helper Text

The **Helper Text** is instructional text displayed below the field
during data collection. Use it to tell collectors what kind of
information to enter, what units to use, or how to handle edge cases.

Helper Text supports **Markdown formatting** — you can use `**bold**`,
`*italic*`, or `[links](https://example.com)` to emphasise key
instructions.

## Tips

- **Keep Field Headings concise** — they appear in mobile interfaces where
  screen space is limited.
- **Use Helper Text for instructions, not titles** — the Field Heading already
  serves as the field's title. Use Helper Text to explain _how_ to
  fill in the field, not _what_ the field is.
- **Treat Export Title as the spreadsheet column** — change it when you
  want a tidier export, not when you want collectors to see a different
  heading.
