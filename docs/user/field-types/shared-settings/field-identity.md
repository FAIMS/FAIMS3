# Field Identity

_The Label, Helper Text, and Export name that every field shares._

---

## Overview

When you expand a field by clicking its grey header bar, you will see the
field's type badge (e.g., "FAIMSTextField"), its Helper Text preview in
italic, and the toolbar icons. Below that, the first panel contains
two identity inputs ("Label" and "Export name") plus a "Helper Text"
input field. The Label is what collectors see. The Export name is the
column header in CSV and GIS exports. Helper Text allows you to provide
guidance to data collectors using the {{notebook}}.

```{screenshot} field-types-design/shared-03-field-identity.png
:alt: Field identity panel showing Label, Helper Text, and Export name for the Feature description field
:align: right
:width: 100%
```

## Label

The **Label** is the display name shown above the field during data
collection.

**Choose a label that is short, descriptive, and unambiguous.** Good
labels read naturally on a phone — for example, "Feature type", "Soil
colour", or "Artefact count".

Changing the Label does not change stored data or export column names.

## Export name

The **Export name** is the column header used when you export data to
CSV or GIS. When you type a Label on a new field, the Export name
auto-generates by converting spaces to hyphens — for example,
"Feature description" becomes `Feature-description`. The original
capitalisation is preserved.

You can **edit the Export name directly** if you need a different
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

- **Keep Labels concise** — they appear in mobile interfaces where
  screen space is limited.
- **Use Helper Text for instructions, not titles** — the Label already
  serves as the field's title. Use Helper Text to explain _how_ to
  fill in the field, not _what_ the field is.
- **Treat Export name as the spreadsheet column** — change it when you
  want a tidier export, not when you want collectors to see a different
  heading.
