# Choosing a Field Type

*A guide to selecting the right field type for your data.*

---

## Overview

When you add a field to a form in the Notebook Editor, the
[ADD A FIELD dialog](adding-a-field.md) presents nearly two dozen
field types across eight tabs. This guide helps you choose the right one
by matching your data requirements to specific fields. It covers design
principles, a quick comparison of every field type, and decision logic
organised by the kind of data you need to capture.

For a complete list of field types with links to configuration guides,
see [Field Types](field-type-index.md). For guidance on combining
fields into effective forms, see
[Form Design Patterns](form-design-patterns.md).

## Design Principles

Five principles will help you design forms that work well in the field:

- **Minimise recording friction.** Automate everything the system can
  know — user identity, timestamps, and location are handled by the
  platform. Design for environmental extremes: bright sunlight, rain,
  cold fingers.
- **Prefer controlled vocabularies over free text.** Structured choices
  prevent errors at the point of collection, support cross-project
  comparability, and make exported data immediately ready for analysis.
  Use an "Other" option to handle exceptions.
- **Design for the full data lifecycle.** Consider how data will be
  exported, analysed, and preserved. Automatic provenance (who, when,
  where) and navigable relationships between records save time
  downstream.
- **Automate system-knowable information.** Do not ask users to type
  their name or the current date — the platform records these
  automatically. Reserve fields for information only humans can provide.
- **Use progressive disclosure.** Keep forms simple by default, and
  reveal detailed fields only when needed — for example, showing
  measurement fields only when a "Record detailed measurements?"
  checkbox is ticked.

## Quick Comparison

The tables below summarise every field type by category, matching the
tabs in the ADD A FIELD dialog.

### Text

| Field Type | Purpose | Good For |
| ---------- | ------- | -------- |
| **[FAIMS Text Field](faims-text-field.md)** | Brief text entry | Codes, identifiers, short labels |
| **Multi-line Text Field** | Extended text entry | Narrative descriptions, observations |
| **[Email](email-field.md)** | Validated email input | Contact addresses |
| **Templated String** | Auto-generated text | Human-readable record identifiers |
| **QR / Barcode Scanner** | Camera-based scanning | Specimen barcodes, equipment tags (mobile only) |
| **Address** | Structured address capture | Site locations, property details |

### Numbers

| Field Type | Purpose | Good For |
| ---------- | ------- | -------- |
| **[Number Input](number-input.md)** | Numeric entry | Measurements, counts, scientific readings |
| **Controlled Number** | Bounded numeric entry | pH (0–14), percentages (0–100), ratings |
| **Auto Incrementing Field** | Sequential identifiers | Specimen numbers, catalogue IDs |

### Date and Time

| Field Type | Purpose | Good For |
| ---------- | ------- | -------- |
| **Date and Time with Now button** | Timezone-aware timestamps | Observation moments, event timing |
| **Date picker** | Date-only selection | Excavation dates, permit dates |
| **Month picker** | Month-and-year selection | Seasonal data, approximate dates |
| **Date time picker** | Date and time selection | Precise event timing (no timezone support) |

### Media

| Field Type | Purpose | Good For |
| ---------- | ------- | -------- |
| **Take Photo** | Camera capture | Context photos, specimen images |
| **Upload a File** | File attachment | PDFs, spreadsheets, audio recordings |

### Location

| Field Type | Purpose | Good For |
| ---------- | ------- | -------- |
| **Take GPS Point** | Single coordinate capture | Find spots, sample locations |
| **Map Field** | Interactive map drawing | Site boundaries, transects, polygons |

### Choice

| Field Type | Purpose | Good For |
| ---------- | ------- | -------- |
| **[Checkbox](checkbox.md)** | Boolean toggle | Presence/absence, yes/no flags |
| **Select one option** | Visible single selection | Short lists of 2–10 items |
| **[Select Field](select.md)** | Dropdown single selection | Lists of 8–20 items |
| **Select Multiple** | Multiple selection | Multi-attribute recording |
| **Select Field (Hierarchical)** | Nested vocabulary tree | Taxonomies, large lists (>20 items) |

### Relationship

| Field Type | Purpose | Good For |
| ---------- | ------- | -------- |
| **Related Records** | Bidirectional record links | Parent–child and peer relationships |

### Display

| Field Type | Purpose | Good For |
| ---------- | ------- | -------- |
| **Rich Text** | Formatted instructions | Procedures, warnings, headings |

## Which Field Type Do I Need?

Work through the section that matches your data type. Each one walks
you through the key decisions.

### Text and Identifiers

If the value can be **generated automatically** from other fields — such
as a record identifier — use a **Templated String**. This is essential
for human-readable record identifiers (HRIDs); without one, the system
defaults to opaque UUIDs.

If a **controlled vocabulary** exists or could be developed for the
data, use a choice field instead (see
[Choices and Controlled Vocabularies](#choices-and-controlled-vocabularies)
below).

If the text is **predictably brief** (under about 100 characters) — a
code, a name, a short label — use a
**[FAIMS Text Field](faims-text-field.md)**. If you expect **extended
narrative** — paragraph-length descriptions, detailed observations — use
a **Multi-line Text Field**.

For **specialised validation**, use the matching field type:

- Email addresses → **[Email](email-field.md)**
- Physical addresses → **Address**
- Barcodes or QR codes → **QR / Barcode Scanner** (mobile only)

### Numbers

If the value has **known valid ranges** (e.g., pH 0–14, percentage
0–100), use a **Controlled Number** — it enforces minimum and maximum
bounds, supports default values, and can carry its value forward to new
records.

If the value is a **sequential identifier** (specimen 001, 002, 003…),
use an **Auto Incrementing Field**. Be aware that the sequence cannot be
reset mid-project.

For **general numeric data** — measurements, counts, calculations — use
a **[Number Input](number-input.md)**.

> **Note:** An older Number Field (deprecated) may appear in some
> existing {{notebooks}}. Use Number Input or Controlled Number for new
> forms.

### Dates and Times

Choose based on the level of temporal detail you need:

- **Current moment** (observation timestamp) →
  **Date and Time with Now button** — the recommended date-time field,
  with timezone support and a one-tap capture button.
- **Date only** (excavation date, permit date) → **Date picker**.
- **Month and year only** (seasonal records) → **Month picker**.
- **Date and time without timezone** → **Date time picker**. Consider
  using **Date and Time with Now button** instead if timezone accuracy
  matters.

### Choices and Controlled Vocabularies

The number of options and the selection type determine which field to
use:

**For single selection:**

- **2 states (yes/no, present/absent)** →
  **[Checkbox](checkbox.md)** for a simple toggle, or
  **Select one option** if you need string values rather than
  true/false.
- **2–10 options** → **Select one option** — all choices are visible,
  making selection fast on mobile.
- **8–20 options** → **[Select Field](select.md)** — a dropdown that
  conserves screen space.
- **More than 20 options or hierarchical structure** →
  **Select Field (Hierarchical)** — supports searching and tree
  navigation.

**For multiple selection:**

- Use **Select Multiple** regardless of list size. For fewer than about
  10 options, the expanded checklist display works well.

### Photos and Files

- **Photographs in the field** → **Take Photo** — integrates with the
  device camera and preserves GPS metadata on mobile.
- **Documents or other files** → **Upload a File** — accepts any file
  type.

On mobile, prefer **Take Photo** for image capture. On desktop, use
**Upload a File** for diverse media types.

### Location and Spatial Data

- **A single GPS coordinate** → **Take GPS Point** — one-tap capture
  with accuracy metadata.
- **Boundaries, transects, or areas** → **Map Field** — draw points,
  lines, and polygons on a base map. Requires an internet connection
  for initial tile loading (offline maps are experimental).
- **Both point and area data** → combine both field types in the same
  form.

> **Note:** GPS accuracy is significantly better on mobile devices than
> on desktop browsers.

### Record Relationships

- **Parent–child or peer connections** between records →
  **Related Records** — creates bidirectional links with defined
  relationship types.
- For best performance, keep relationships under 50 per record.

## Common Mistakes

- **Using free text when a controlled vocabulary would work.** This
  creates inconsistent data that requires extensive cleaning. Add an
  "Other" option to controlled lists for exceptions.
- **Requiring unnecessary precision.** Do not demand exact measurements
  when estimates suffice — match precision to your actual research
  needs.
- **Ignoring platform constraints.** QR / Barcode Scanner is mobile
  only; Map Field requires an internet connection. Design for your
  actual deployment platform.
- **Over-using required fields.** Marking fields as required "just in
  case" prevents record submission for minor omissions. Only require
  fields that are truly essential.
- **Creating deeply nested relationships.** Avoid nesting beyond three
  or four levels — it makes navigation cumbersome in the field.
- **Designing only for desktop.** Test your form on the actual mobile
  devices your team will use.

## Things to Keep in Mind

- **Every form needs a human-readable identifier.** Without a
  **Templated String** configured as the HRID, records appear as
  opaque identifiers (e.g., "rec-5f8a9b3c"). A dedicated HRID guide
  is planned.
- **QR / Barcode Scanner is mobile only.** It will not function on
  desktop browsers.
- **Map Field requires an internet connection** for initial tile
  loading. Offline map support is experimental.
- **Plan your vocabularies before building.** The display label and
  stored value are always the same — what users see is exactly what
  appears in exported data.
- **Each record type exports as a separate CSV.** Relationships are
  preserved through identifier columns. Plan your data model with
  export in mind.

For guidance on combining fields into effective forms, see
[Form Design Patterns](form-design-patterns.md).
