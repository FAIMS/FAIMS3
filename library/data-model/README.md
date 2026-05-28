# FAIMS3 Data Model

[![codecov](https://codecov.io/gh/FAIMS/faims3-data-model/branch/main/graph/badge.svg?token=K3ZSV58M3C)](https://codecov.io/gh/FAIMS/faims3-data-model)

This module provides a common database handling API for the front and back ends
of the FAIMS project. Used in both the FAIMS3 front-end app and the backend FAIMS3-Conductor server to access data in the CouchDB/PouchDB databases.

## Notebook definition (`uiSpecification`)

Survey and template form designs are stored as **`uiSpecification`** on Couch documents (projects DB v4+, templates DB v5+), typed in `src/uiSpecification/`. API Zod schemas are in `src/api.ts`.

- **Normalisation:** `src/uiSpecification/normalize.ts` — legacy upload → `migrateNotebook` → strict `NotebookDefinition`
- **Notebook schema migrations:** `src/data_storage/migrations/notebookMigrations/` (target: `CURRENT_NOTEBOOK_UI_SCHEMA_VERSION`)
- **Inlining former metadata DB:** `projectsV3toV4Migration` in `src/data_storage/migrations/migrations.ts`

See `docs/developer/docs/source/markdown/NotebookDefinition.md` in the repository.
