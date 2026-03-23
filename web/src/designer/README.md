# Designer module architecture

This module contains the embedded notebook designer used by the web app.

## Runtime flow

1. Host screens open the designer dialog:
   - `components/dialogs/designer-dialog.tsx`
2. The dialog renders:
   - `designer/DesignerWidget.tsx`
3. Widget state is created by:
   - `designer/createDesignerStore.ts`
4. Save/load integration for host tabs is centralized in:
   - `designer/integration/notebookAdapters.ts`
   - `designer/integration/useDesignerSaveMutation.ts`

## Current module layout

- `components/`
  - React UI for form/section/field editing, conditions, and dialogs.
- `state/`
  - Core state types (`initial.ts`), hooks (`hooks.ts`), metadata/modified reducers, and helper utilities.
- `store/`
  - Canonical ui-spec slice reducers under `store/slices/uiSpec/*`
  - undo config and selector utilities.
- `domain/`
  - Pure data and condition logic (no React rendering).
- `features/`
  - Shared feature utilities such as field update helpers and the field editor registry.
- `types/`
  - Shared designer type definitions (including condition types).

## Legacy cleanup status

Legacy standalone and compatibility artifacts have been removed. The codebase no longer relies on:

- standalone app/store/localStorage paths
- legacy notebook loader/review/roles panels
- compatibility re-export shims for ui-spec reducers or condition types
- unused scaffold barrels that were not imported

All active imports now point to canonical source modules.
