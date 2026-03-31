# Notebook Migrations

`data-model/src/data_storage/migrations/notebookMigrations` implements a basic
migration for notebooks.

Each notebook has a property `schema_version` in metadata that records the
schema version that it conforms to. In very early versions this was missing. In
more recent notebooks this will have the value `1.0`.

The notebook migration code uses the schema version property to decide whether
to apply a migration to the notebook. This can be configured to run on
startup of the API server (`MIGRATE_NOTEBOOKS_ON_STARTUP`) but will also
run when a notebook is loaded into the editor (this was the previous behaviour).

The currently implemented migration runs for any notebook where schema version is
missing or has the value 1.0. It updates a number of changed notebook structures
but does so in an idempotent manner meaning multiple migrations would be safe.

Future migrations will require some planning and design work to ensure that we
can manage versions cleanly and migrate through different versions. This will
need to be done when we make future updates to the notebook format.
