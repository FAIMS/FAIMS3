# Field Types

*An overview of the field types available in the Notebook Editor.*

---

## Overview

When you design a data collection form in the Notebook Editor, each piece of
information you want to record — a measurement, a description, a photograph,
a location — is captured by a field. {{FAIMS}} provides a range of field types
to match different kinds of data, from short text and numbers to photographs,
GPS coordinates, and hierarchical vocabularies. This page lists every field
type by category, links to the detailed configuration guides that are
available, and notes where guides are still to come.

## Shared Settings and Controls

Four guides cover settings and controls that apply to every field type:

- **[Adding a Field](adding-a-field.md)** — How to open the Add a
  Field dialog and add a new field to your form.
- **[Field Identity](field-identity.md)** — The Label, Helper Text,
  and Field ID that every field shares.
- **[Field Toolbar](field-toolbar.md)** — The icon toolbar in each
  field's header bar.
- **[Field Options](field-options.md)** — Shared options available on
  every field type, including validation, annotations, visibility logic, and
  data persistence.

## Text Fields

The **TEXT** tab contains field types for capturing text-based data, from
short codes and labels to multi-line descriptions and email addresses.

- **[FAIMS Text Field](faims-text-field.md)** — A single-line input for
  brief, unconstrained text such as codes, identifiers, and short labels.
- **[Email](email-field.md)** — A single-line text input with built-in email
  format validation that opens the email keyboard on mobile devices.
- **Multi-line Text Field** — Extended text entry for narrative content and
  detailed observations, with internal scrolling for longer passages.
  *(guide planned)*
- **Templated String** — Auto-generates text from other fields using
  templates; required for human-readable record identifiers.
  *(guide planned)*
- **QR / Barcode Scanner** — Mobile-only barcode and QR code scanning,
  supporting multiple barcode formats. *(guide planned)*
- **Address** — Structured address capture storing data in a
  geocoding-compatible format. Beta feature. *(guide planned)*

## Number Fields

The **NUMBERS** tab contains field types for numeric and sequential data.

- **[Number Input](number-input.md)** — Accepts numeric data including
  measurements, counts, calculations, and scientific readings, with support
  for integers, decimals, and scientific notation.
- **Controlled Number** — A bounded numeric input for ratings, scores, and
  measurements with minimum and maximum constraints. *(guide planned)*
- **Auto Incrementing Field** — Generates sequential string identifiers such
  as specimen numbers and catalogue IDs. *(guide planned)*

## Date and Time Fields

The **DATE & TIME** tab contains field types for recording dates, times, and
timestamps.

- **Date time picker** — Captures date and time values. Consider
  **Date and Time with Now button** instead for timezone support.
  *(guide planned)*
- **Date picker** — Date-only selection for administrative records, permits,
  and excavation dates. *(guide planned)*
- **Month picker** — Month-and-year selection for records where exact dates
  are unknown or unnecessary. *(guide planned)*
- **Date and Time with Now button** — Timezone-aware timestamp capture with
  an automatic current-time button; the recommended date-time field.
  *(guide planned)*

## Media Fields

The **MEDIA** tab contains field types for capturing photographs and
uploading files.

- **Take Photo** — Captures photographs using the device camera or gallery,
  with GPS tagging on native platforms. *(guide planned)*
- **Upload a File** — Attaches files of any type from the device, queued for
  synchronisation. *(guide planned)*

## Location Fields

The **LOCATION** tab contains field types for recording GPS coordinates and
map-based spatial data.

- **Take GPS Point** — Single-tap GPS coordinate capture, returning a
  GeoJSON point with accuracy metadata. *(guide planned)*
- **Map Field** — Interactive map for drawing points, lines, and polygons on
  base map tiles. *(guide planned)*

## Choice Fields

The **CHOICE** tab contains field types for controlled vocabulary input,
from simple checkboxes to hierarchical selection lists.

- **[Select Field](select.md)** — Lets users pick one option from a dropdown
  list, suitable for site types, artefact categories, condition assessments,
  and similar single-selection questions.
- **[Checkbox](checkbox.md)** — A toggle that stores a boolean value (checked
  or unchecked) for presence/absence indicators, consent acknowledgements, and
  data quality flags.
- **Select Multiple** — Lets users pick multiple options from a predefined
  list, with dropdown or expanded checklist display. *(guide planned)*
- **Select Field (Hierarchical)** — Navigates a nested vocabulary tree to
  select a value. Beta feature. *(guide planned)*
- **Select one option** — Displays all options as a visible list for single
  selection; suited to short lists of 2–10 items. *(guide planned)*

## Relationship Fields

The **RELATIONSHIP** tab contains the field type for connecting records with
bidirectional relationships.

- **Related Records** — Creates bidirectional links between records,
  supporting parent–child and peer relationships. *(guide planned)*

## Display Fields

The **DISPLAY** tab contains the field type for presenting static formatted
content and instructions within a form.

- **Rich Text** — Displays formatted instructional content and headings
  within a form; does not capture data. *(guide planned)*

## Designing Forms for Fieldwork

- **[Choosing a Field Type](field-selection-guide.md)** — A guide to
  selecting the right field type for your data, with design principles,
  a quick comparison, and decision logic by data type.
- **[Form Design Patterns](form-design-patterns.md)** — Practical
  patterns for combining field types, with examples from archaeology,
  ecology, and geology.
