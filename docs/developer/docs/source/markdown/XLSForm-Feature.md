# XLSForm Import Feature Documentation

## Overview

This feature lets users create and replace Fieldmark templates and projects
by uploading an XLSForm (`.xlsx`) file, as an alternative to authoring or
uploading a JSON file. The way the feature works is that the user passes in
the XLSForm document to the browser, the browser uploads the raw spreadsheet
to the api, and a single shared endpoint converts it into a Fieldmark `uiSpecification`,
which is then passed into the existing, unmodified template/project creation
and update endpoints.

## Architecture

```
User selects a .xlsx file in the browser
        │
        ▼
Frontend converts the file to base64 and calls:
        │
        ▼
POST /api/convert-xlsform  (in api/src/api/utilities.ts)
        │  - decodes the base64 buffer
        │  - parses survey/choices/settings sheets (parseXlsformBuffer)
        │  - converts parsed rows into a Fieldmark uiSpecification
        │    (convertXlsformToNotebookDefinition)
        │  - returns { uiSpecification, skipped }
        ▼
Frontend receives the uiSpecification, then calls the same endpoint
it would have called for a plain JSON upload:
        │
        ▼
POST /api/templates/          (create a template)
PUT  /api/templates/:id/uiSpecification   (replace a template's design)
POST /api/notebooks           (create a project)
PUT  /api/notebooks/:id/uiSpecification   (replace a project's design)
        │
        ▼
Template/project is created or updated exactly as if the uiSpecification
had come from a hand-authored JSON file.
```

The frontend performs two sequential api calls for an XLSForm upload
(convert, then create/update) instead of one. For a plain JSON upload,
nothing changes — that path is untouched and still makes a single call.

---

## File-by-file reference

### Conversion logic (`library/data-model`)

| File                                      | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/uiSpecification/xlsformConverter.ts` | Core converter. `convertXlsformToNotebookDefinition(sheets, schemaVersion)` maps parsed XLSForm rows to a Fieldmark `NotebookDefinition`. Field names are derived deterministically from each row's own `name` column, so converting the same file twice always produces identical field names. This is required so that re-uploading an edited XLSForm to _replace_ an existing template/project's design never silently orphans data tied to the old field names. Unsupported XLSForm question types are collected into a `skipped` array rather than failing the whole conversion. |
| `src/uiSpecification/types.ts`            | Shared type definitions, including the XLSForm input shapes (`SurveyRow`, `ChoiceRow`, `SettingsRow`, `XlsformSheets`), defined as Zod schemas with inferred types, matching this file's existing convention. Imported by both the converter and the parsing layer, so the shape is defined once.                                                                                                                                                                                                                                                                                     |
| `tests/xlsformConverter.test.ts`          | 27 unit tests covering every supported field type plus edge cases: missing labels/hints, `required` string-to-boolean handling, unsupported-type skipping, HRID field selection, and determinism (the same input always produces identical output).                                                                                                                                                                                                                                                                                                                                   |

### Server-side parsing (`api`)

| File                          | Purpose                                                                                                                                                                                                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/utils/xlsformParsing.ts` | `parseXlsformBuffer(buffer)` reads an uploaded `.xlsx` file buffer (via `read-excel-file`) into `survey` / `choices` / `settings` row objects. Blank separator rows and structural rows with no `name` (e.g. `end group`) are filtered out rather than causing the whole file to be rejected |
| `src/api/utilities.ts`        | Contains the single shared `POST /convert-xlsform` route (mounted at `/api/convert-xlsform`). Accepts `{fileBase64}`, returns `{uiSpecification, skipped}`. No template/project metadata is created or touched here.                                                                         |

### Frontend (`web`)

| File                                            | Purpose                                                                                                                                                                                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/hooks/xlsform-hooks.ts`                    | `convertXlsformToUiSpecification({user, file})` the single shared frontend function that calls `POST /api/convert-xlsform`. Used by all four forms below. Returns `{ok, uiSpecification, skipped}` or `{ok: false, message}` on failure. |
| `src/components/forms/create-template-form.tsx` | If the uploaded file is `.xlsx`, calls `convertXlsformToUiSpecification`, then proceeds through the same `POST /api/templates/` call used for a JSON upload or a blank notebook.                                                         |
| `src/components/forms/update-template-form.tsx` | Same pattern, targeting `PUT /api/templates/:id/uiSpecification`.                                                                                                                                                                        |
| `src/components/forms/create-project-form.tsx`  | Same pattern, targeting `POST /api/notebooks`. This form has a third path (creating from an existing template) which is unrelated to file conversion and unaffected by this feature.                                                     |
| `src/components/forms/update-project-form.tsx`  | Same pattern, targeting `PUT /api/notebooks/:id/uiSpecification`.                                                                                                                                                                        |
| `src/lib/input-limits.ts`                       | `designFileSchema()` (shared file-upload validation) accepts `.xlsx` alongside `.json`. `fileToBase64()` encodes the uploaded file for the API call.                                                                                     |

All four forms show a toast notification (via `sonner`) after an XLSForm
upload succeeds: a warning listing any skipped question types, or a plain
success message if everything converted.

---

## Supported XLSForm question types (v1)

| XLSForm `type`           | Fieldmark component    |
| ------------------------ | ---------------------- |
| `text`                   | TextField              |
| `integer`                | NumberField (integer)  |
| `decimal`                | NumberField (floating) |
| `select_one <list>`      | RadioGroup             |
| `select_multiple <list>` | MultiSelect            |
| `date`                   | DatePicker             |
| `dateTime`               | DateTimePicker         |
| `geopoint`               | TakePoint              |
| `image`                  | TakePhoto              |
| `file`                   | FileUploader           |

Field mappings were confirmed directly against Fieldmark's own field
registry source (`library/forms/lib/fieldRegistry`), not just its
documentation, since the two do not always agree (see "Known gaps" below).

## Explicitly out of scope for v1

- **Groups** (`begin_group` / `end_group`) — a clean mapping to
  Fieldmark's `views` is possible, but has not been implementedn.
- **Repeating questions** (`begin_repeat` / `end_repeat`) — confirmed to have
  **no equivalent construct in Fieldmark at all**. Rows inside a repeat are
  still imported (flattened to a single occurrence); the repeat behaviour
  itself is dropped and reported via `skipped`.
- **`relevant` / `constraint` logic** — XLSForm's skip-logic and validation
  expressions are not translated into Fieldmark's conditional system. Fields
  still convert; the logic attached to them does not.
- **`calculate`** — no path exists; Fieldmark's `ComputedField` supports
  numeric arithmetic only and rejects any function call.
- **`note`** — not yet mapped (a `RichText`/display-only field is the likely
  target, not yet implemented).
- **Metadata auto-capture types** (`start`, `end`, `deviceid`, `username`,
  `phonenumber`, `audit`, etc.) as no Fieldmark equivalent.
- **`photo`** — a known XLSForm alias for `image`,not yet added as an accepted alias in
  the converter's `switch` statement (currently falls through to `skipped`).

---

## Suggested next steps

1. Rewrite `xlsformTemplate.test.ts` against the current architecture.
2. Add the `photo` → `image` alias.
3. Revisit the HRID auto-selection heuristic.
4. Decide on groups (`begin_group`/`end_group`) inclusion for a future version.
