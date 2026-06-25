# Exporting your data

There are three types of export from {{FAIMS}}:

1. Tabular data
2. Spatial data
3. Attachments

Data can be exported from the selected {{Notebook}} on the [{{Dashboard}}](../admin/web.md).

## Tabular data

The default method of export is tabular data in the form of _comma separated values_ (csv).

Each _Form_ or entity will have its own .csv file.

## Spatial data

Spatial fields (map input, GPS, etc.) can be exported as **GeoJSON**, **KML**, or **GeoPackage** (`.gpkg` for QGIS and similar tools). Choose a format from the project export screen, or include one or more spatial files in a **full export** ZIP.

For implementation details (pipeline, GDAL, single-pass archive export), see the developer doc [Geospatial export pipeline](../../developer/docs/source/markdown/GeospatialExport.md).

## Attachments

Images and attached files can be exported in ZIP format separately (ie _Form_ by _Form_), or as a bundle.

Images, files and folders are renamed in accordance with the record's chosen identifier, saving time when you return from the field.

```{note}
Exported data and files cannot be restored to the App. See for instructions on how to backup your {{Notebook}} in .json format to restore for future use.
```

## Advanced export methods

Data can be exported from {{FAIMS}} [API](api-tokens.md) or [Integrations](integrations.md).
