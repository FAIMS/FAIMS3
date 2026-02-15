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

- **Minimise recording friction.** Reserve fields for information only
  humans can provide — the platform automatically captures user
  identity, timestamps, and location. Design for environmental
  extremes: bright sunlight, rain, cold fingers, and gloved hands.
- **Prefer controlled vocabularies over free text.** Structured choices
  prevent errors at the point of collection, support cross-project
  comparability, and make exported data immediately ready for analysis.
  Use an "Other" option to handle exceptions.
- **Design for the full data lifecycle.** Consider how data will be
  exported, analysed, and preserved. Automatic provenance (who, when,
  where) and navigable relationships between records save time
  downstream.
- **Use progressive disclosure.** Keep forms simple by default, and
  reveal detailed fields only when needed — for example, showing
  measurement fields only when a "Record detailed measurements?"
  checkbox is ticked.
- **Expect the unexpected.** Controlled vocabularies and tight form
  structure are essential for analysis-ready data, but fieldwork
  always produces serendipitous discoveries and unanticipated
  complications. Build in escape valves:
  include a free-text observations field at the record level for
  general notes, and enable Annotation and Uncertainty on individual
  fields so collectors can flag unusual values, note recording
  conditions, or document exceptions without breaking the structured
  data. These are your "margins of the page."

## Quick Comparison

The tables below summarise every field type by category, matching the
tabs in the ADD A FIELD dialog.

### Text

| Field Type | Purpose | Good For |
| ---------- | ------- | -------- |
| **[FAIMS Text Field](faims-text-field.md)** | Brief text entry | Codes, identifiers, short labels |
| **[Multi-line Text Field](multiline-text-field.md)** | Extended text entry | Narrative descriptions, observations |
| **[Email](email-field.md)** | Validated email input | Contact addresses |
| **[Templated String](templated-string.md)** | Auto-generated text | Human-readable record identifiers |
| **[QR / Barcode Scanner](qr-barcode-scanner.md)** | Camera-based scanning | Specimen barcodes, equipment tags (mobile only) |
| **[Address](address.md)** | Structured address capture | Site locations, property details |

### Numbers

| Field Type | Purpose | Good For |
| ---------- | ------- | -------- |
| **[Number Input](number-input.md)** | Numeric entry | Measurements, counts, scientific readings |
| **[Controlled Number](controlled-number.md)** | Bounded numeric entry | pH (0–14), percentages (0–100), ratings |
| **[Auto Incrementing Field](auto-incrementing-field.md)** | Sequential identifiers | Specimen numbers, catalogue IDs |

### Date and Time

| Field Type | Purpose | Good For |
| ---------- | ------- | -------- |
| **[Date and Time with Now button](date-time-now.md)** | Timezone-aware timestamps | Observation moments, event timing |
| **[Date picker](date-picker.md)** | Date-only selection | Excavation dates, permit dates |
| **[Month picker](month-picker.md)** | Month-and-year selection | Seasonal data, approximate dates |
| **[Date time picker](date-time-picker.md)** | Date and time selection | Precise event timing (no timezone support) |

### Media

| Field Type | Purpose | Good For |
| ---------- | ------- | -------- |
| **[Take Photo](take-photo.md)** | Camera capture | Context photos, specimen images |
| **[Upload a File](attach-file.md)** | File attachment | PDFs, spreadsheets, audio recordings |

### Location

| Field Type | Purpose | Good For |
| ---------- | ------- | -------- |
| **[Take GPS Point](take-gps-point.md)** | Single coordinate capture | Find spots, sample locations |
| **[Map Field](map-input.md)** | Interactive map drawing | Site boundaries, transects, polygons |

### Choice

| Field Type | Purpose | Good For |
| ---------- | ------- | -------- |
| **[Checkbox](checkbox.md)** | Boolean toggle | Presence/absence, yes/no flags |
| **[Select one option](radio-group.md)** | Visible single selection | Short lists of 2–10 items |
| **[Select Field](select.md)** | Dropdown single selection | Lists of 8–20 items |
| **[Select Multiple](multi-select.md)** | Multiple selection | Multi-attribute recording |
| **[Select Field (Hierarchical)](hierarchical-select.md)** | Nested vocabulary tree | Taxonomies, large lists (>20 items) |

### Relationship

| Field Type | Purpose | Good For |
| ---------- | ------- | -------- |
| **[Related Records](related-records.md)** | Bidirectional record links | Parent–child and peer relationships |

### Display

| Field Type | Purpose | Good For |
| ---------- | ------- | -------- |
| **[Rich Text](rich-text.md)** | Formatted instructions | Procedures, warnings, headings |

## Which Field Type Do I Need?

Work through the section that matches your data type. Each one walks
you through the key decisions.

### Text and Identifiers

If a value, e.g., for an identifier, can be **generated
automatically** from other fields — such as a feature identifier
combining an auto-incrementing feature number plus the feature
type — use a **[Templated String](templated-string.md)**. Doing so
produces a *human-readable record identifier (HRID)*, which is
essential; without one, the system defaults to opaque UUIDs.

If a **controlled vocabulary** exists or could be developed for the
data, use a choice field (see
[Choices and Controlled Vocabularies](#choices-and-controlled-vocabularies)
below).

If the text is **predictably brief** (under about 100 characters) — a
code, a name, a short label — use a
**[FAIMS Text Field](faims-text-field.md)**.

If you expect **extended narrative**, like paragraph-length
descriptions or detailed observations, use a
**[Multi-line Text Field](multiline-text-field.md)**.

If the value can be **read from a physical label** — such as a QR
code on a sample bag or a barcode on equipment — use
**[QR / Barcode Scanner](qr-barcode-scanner.md)** (mobile only).
This eliminates transcription errors for pre-labelled items.

For **specialised validation**, use the matching field type:

- Email addresses → **[Email](email-field.md)**
- Physical addresses → **[Address](address.md)**

### Numbers

If the value has **known valid ranges** (e.g., pH 0–14, percentage
0–100), use a
**[Controlled Number](controlled-number.md)** — it enforces minimum
and maximum bounds and supports default values.

If the value is a **sequential number**, e.g., for an identifier
(specimen 001, 002, 003…), use an
**[Auto Incrementing Field](auto-incrementing-field.md)**. Be aware that the
sequence cannot be reset mid-project, but that different devices can
be assigned different ranges for the same field.

For **general numeric data** — measurements, counts, calculations — use
a **[Number Input](number-input.md)**.

### Dates and Times

Choose based on the level of temporal detail you need:

- **Current moment** (observation timestamp) →
  **[Date and Time with Now button](date-time-now.md)** — the
  recommended date-time field, with timezone support and a one-tap
  capture button. Also supports arbitrary date and time entry in
  addition to "now."
- **Date only** (excavation date, permit date) →
  **[Date picker](date-picker.md)**.
- **Month and year only** (seasonal records) →
  **[Month picker](month-picker.md)**.
- **Date and time without timezone** →
  **[Date time picker](date-time-picker.md)** does not store
  timezone; consider using
  **[Date and Time with Now button](date-time-now.md)** instead.

### Choices and Controlled Vocabularies

The number of options and the selection type determine which field to
use:

**For single selection:**

- **2 states (yes/no, present/absent)** →
  **[Checkbox](checkbox.md)** for a simple true/false toggle, or
  **[Select one option](radio-group.md)** if you need string values
  rather than true/false.
- **ca. 2–10 options** →
  **[Select one option](radio-group.md)** — all choices are
  visible, making selection fast on mobile.
- **ca. 8–20 options** → **[Select Field](select.md)** — a
  dropdown that conserves screen space but takes an extra tap to
  show the list then select.
- **Many options or hierarchical structure** →
  **[Select Field (Hierarchical)](hierarchical-select.md)** —
  supports searching and tree navigation.

**For multiple selection:**

- Use **[Select Multiple](multi-select.md)** regardless of list
  size. Configurable as a dropdown or expanded checklist. For fewer
  than about 10 options, the expanded checklist works well.

### Photos and Files

- **Photographs in the field** →
  **[Take Photo](take-photo.md)** — integrates with the device camera
  and preserves GPS metadata on mobile. Can also upload photos,
  supporting workflows that mix on-device and external cameras.
- **Documents, drawings, or other files** →
  **[Upload a File](attach-file.md)** — accepts any file type.

On mobile, prefer **[Take Photo](take-photo.md)** for photography
workflows that may involve image capture with the on-device camera.
On desktop, use **[Upload a File](attach-file.md)** for diverse
document and media types.

### Location and Spatial Data

- **A single GPS coordinate** →
  **[Take GPS Point](take-gps-point.md)** — one-tap capture with
  accuracy metadata.
- **Boundaries, transects, or areas** →
  **[Map Field](map-input.md)** — draw points,
  lines, and polygons on a base map. Requires an internet connection
  for initial tile loading (offline maps are experimental).
- **Both point and area data** → combine both field types in the same
  form.

> **Note:** location accuracy is better on mobile devices than
> on desktop browsers.

### Record Relationships

- **Parent–child or peer connections** between records →
  **[Related Records](related-records.md)** — creates
  bidirectional links with defined relationship types.

## Common Mistakes

- **Using free text when a controlled vocabulary would work.** This
  creates inconsistent data that requires extensive cleaning. Add an
  "Other" option to controlled lists for exceptions.
- **Requiring unnecessary precision.** Do not demand exact
  measurements when estimates suffice, or impose ranges that
  are too tight — match precision to your actual research
  needs.
- **Ignoring platform constraints.** QR / Barcode Scanner is
  mobile only; Map Field requires an internet connection;
  location accuracy in the web app on desktop may be poor.
  Design for your actual deployment platform.
- **Over-using required fields.** Marking fields as required
  "just in case" antagonises users if applied to minor
  omissions, and too many alerts in the interface hide the
  important ones. Only require fields that are truly
  essential.
- **Creating deeply nested relationships.** Avoid nesting beyond three
  or four levels — it makes navigation cumbersome in the field.
- **Designing only for desktop.** Test your form on the actual mobile
  devices your team will use.
- **Insufficient testing before deployment.** Deploy your {{notebook}}
  under realistic conditions well before fieldwork begins. Problems
  that are invisible on a desktop — awkward field order, missing
  vocabulary options, impractical required fields — only surface when
  someone fills in real data on a mobile device at a real site.
  Discovering these issues mid-campaign is costly to fix.

## Things to Keep in Mind

- **Every form needs a human-readable identifier.** Without a
  **[Templated String](templated-string.md)** configured as
  the HRID, records appear as opaque identifiers (e.g.,
  "rec-5f8a9b3c"). A dedicated HRID guide is planned.
- **[QR / Barcode Scanner](qr-barcode-scanner.md) is mobile only.**
  It will not function on desktop browsers.
- **[Map Field](map-input.md) requires an internet
  connection** for initial tile loading. Offline map support
  is experimental.
- **Plan your vocabularies before building.** The display label and
  stored value are always the same — what users see is exactly what
  appears in exported data.
- **Each record type exports as a separate CSV.** Relationships are
  preserved through identifier columns. Plan your data model with
  export in mind.

For guidance on combining fields into effective forms, see
[Form Design Patterns](form-design-patterns.md).
