# FAIMS3 Dashboard

React SPA for viewing FAIMS projects and their data. Uses the Conductor API for auth and project metadata, and syncs project data from CouchDB into local PouchDB for offline-capable browsing.

## Stack

- Vite, React 18, TypeScript
- Tailwind CSS, MUI, OpenLayers (ol)
- TanStack Query, PouchDB, `@faims3/data-model`, `@faims3/forms`

## Configuration

Copy `.env.dist` to `.env`. Required:

- `VITE_DASHBOARD_URL` – URL where the dashboard is served (e.g. `http://localhost:3002`)
- `VITE_API_URL` – Conductor API base (e.g. `http://localhost:8080`)

Optional: `VITE_COUCHDB_URL` (default `http://localhost:5984`), `VITE_DASHBOARD_TITLE`, map-related vars (see `.env.dist`).

## Running

From repo root:

```bash
pnpm run dev
```

Dashboard runs on port 3002 with api, web, app. Or from `dashboard/`:

```bash
pnpm run dev
```

## Build

```bash
pnpm run build
```

## What it does

- **Auth**: Redirects to Conductor login; on return, exchanges token and stores JWT in localStorage. Token refresh on an interval.
- **Projects panel**: Lists projects from `/api/notebooks`. “Activate dashboard” starts a per-project PouchDB and one-way live sync from CouchDB; shows live record count. “Open” opens the project detail view.
- **Project detail**: Map of spatial fields (points from UI spec), click for popup with record overview and form details via `DataView`. Paginated table of hydrated records. Hydrated cache subscribes to DB changes and rehydrates in batches.

## Structure

- `src/main.tsx` – App shell, auth UI, project list vs project detail routing
- `src/auth-context.tsx` – Auth state, login/logout, token refresh, exchange on load
- `src/api-client.ts` – Fetch projects and project details (notebooks API)
- `src/dashboard-db.ts` – Create PouchDB per project, one-way sync, DataEngine creation
- `src/context/dashboard-project-context.tsx` – In-memory map of project runtimes (engine + local DB + sync handle)
- `src/projects-panel.tsx` – Project list, activate/open, live stats
- `src/views/ProjectDetailView.tsx` – Map, popup, hydrated cache, records table
- `src/utils/hydrated-cache.ts` – Cache of hydrated records with change subscription and batched rehydration
- `src/utils/spatial-fields.ts` – Detect spatial fields from UI spec, parse GeoJSON for map

## Known gaps / TODOs

- **Scaffold copy**: `main.tsx` still describes the app as a “scaffold” and renders optional `projectModel` / `mapConfig` JSON; these props are never passed in normal use.
- **Project detail – attachments**: `IAttachmentService` is a stub; all methods throw (“Attachment service not configured in dashboard view”). No attachment loading or display.
- **Project detail – map**: Map uses hardcoded OSM and a hardcoded `getMapConfig()` in `DataView` tools; `getMapConfig()` from `constants.ts` is not used for the map.
- **Project detail – editing**: `editRecordButtonComponent` is `() => null`; no record editing. `navigateToRecord` / `getRecordRoute` are no-ops.
- **Errors**: Projects panel swallows errors when refreshing dashboard stats (“swallow for prototype”).
- **Tests**: Vitest is configured but there are no test files.
