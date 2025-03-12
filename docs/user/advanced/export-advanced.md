(advanced/export)=
# Advanced Export
:::{note}
This feature is presently in development.
:::

## Jupyter Exporter

Developers may fork the [Jupyter Exporter](https://github.com/FAIMS/FAIMS3-Jupyter-Exporter) to engage in advanced export before our {term}`Conductor` based API arrives.

* The file `export_csv.py` prototypes how data may be extracted from `faims3records.py` using the `CouchDBHelper` found in `faims3couchdb.py`.

## JsonLines Exporter

There exists a private repository with a [jsonlines](https://jsonlines.org/) format raw-json exporter, along with a prototype to demonstrate edits written back into the database along with record deletion and undeletion. Please contact info@fieldmark.au for more details.