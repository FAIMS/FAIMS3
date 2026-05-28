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

## Undo/Redo Architecture

- Undo/redo behavior is implemented once at the store layer with `redux-undo`:
  - `designer/createDesignerStore.ts` wraps `ui-specification` with `undoable(...)`.
  - `designer/store/undoConfig.ts` defines which actions are tracked.
- UI components reuse that existing history state:
  - `state/use-designer-undo-redo.ts` reads `past/future` and dispatches `ActionCreators.undo()` / `ActionCreators.redo()`.
  - `components/notebook-editor.tsx` calls that shared hook (no duplicate undo engine logic).
- `components/design-panel.tsx` does not implement undo logic; it only edits present UI spec state that is already covered by the shared undo configuration.
