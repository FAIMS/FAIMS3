# Designer module architecture

This module contains the notebook designer used by the web app.

## Runtime entrypoint

- **Primary runtime path:** `DesignerWidget.tsx` via `components/dialogs/designer-dialog.tsx`
- **Current host integrations:** project and template actions tabs

## Module boundaries

- `components/`: existing UI components and editors
- `state/`: existing Redux slices, hooks, and helpers (legacy + active mixed)
- `store/`: new refactor surface for shared selectors and store-oriented utilities
- `domain/`: pure business logic and data transforms (no React rendering)
- `features/`: feature-oriented barrels that group UI by area
- `integration/`: host-side adapters/hooks for project/template integration

## Legacy vs active paths

The repository currently contains both active and legacy designer flows.

- **Active flow**
  - `DesignerWidget.tsx`
  - `createDesignerStore.ts`
  - `components/dialogs/designer-dialog.tsx`
  - project/template actions integration

- **Legacy/standalone artifacts retired in this refactor**
  - `App.tsx`
  - `state/store.ts`
  - `components/notebook-loader.tsx`
  - `components/review-panel.tsx`
  - `components/roles-panel.tsx`
  - `state/localStorage.ts`
  - `notebook-schema.ts`
  - `components/Fields/HiddenToggle.tsx`

The refactor path keeps behaviour stable while gradually consolidating around the active embedded flow.
