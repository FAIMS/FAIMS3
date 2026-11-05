# Map layer formats and coordinate systems

This page is for GIS staff preparing overlays for {{FAIMS}}. Start with the
short list below if you just need a file that will work. The later sections
cover CRS, file structure, and edge cases.

Map layers are **display overlays** for collectors (site plans, imagery,
cadastre outlines). They are not a GIS interchange. After upload, {{FAIMS}}
reprojects the file and builds a single device-ready tile archive. Feature
attributes are not shown in the app.

How to upload, link, and use a layer on a device is in
[Map layers](map-layers.md).

## Best-support recipes

These combinations are the ones we prepare and test for. Prefer them when
you can.

| What you have                             | Export this                                       | CRS                                                                      |
| ----------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| Vector boundaries, tracks, or points      | **GeoPackage** (`.gpkg`), one layer               | A projected CRS for the site (for example GDA94 / GDA2020 MGA) or WGS 84 |
| Simple vector you already have as lon/lat | **GeoJSON** (`.geojson`), RFC 7946                | WGS 84, longitude then latitude                                          |
| Aerial / drone / satellite image          | **GeoTIFF** (`.tif`) with the CRS inside the file | Same as the image (UTM, MGA, Web Mercator, or WGS 84)                    |
| A map sheet that is already a GeoPDF      | **Georeferenced PDF** (`.pdf`)                    | Whatever is embedded in the PDF                                          |

Verified in our spatial test suite: **EPSG:4326** (WGS 84), **EPSG:3857**
(Web Mercator), **EPSG:28356** (GDA94 / MGA zone 56), and a Sentinel-2
window in **EPSG:32756** (WGS 84 / UTM zone 56S). Other codes that GDAL
and PROJ can transform to those systems usually work; put them in a
GeoPackage or GeoTIFF rather than in GeoJSON.

## Accepted formats

The combined upload may be at most **2 GB** and **8 files**. Processing
fails if GDAL cannot read a coordinate reference system.

### Raster

| Format            | Extensions      | What must travel with the file                                             |
| ----------------- | --------------- | -------------------------------------------------------------------------- |
| GeoTIFF           | `.tif`, `.tiff` | CRS and geotransform **inside** the file. Cloud-Optimized GeoTIFF is fine. |
| Georeferenced PDF | `.pdf`          | Embedded geotransform and CRS. A plain (not geospatial) PDF fails.         |
| PNG               | `.png`          | Same-basename **world file** (`.pgw` or `.wld`) **and** `.prj`             |
| JPEG              | `.jpg`, `.jpeg` | Same-basename **world file** (`.jgw` or `.wld`) **and** `.prj`             |

### Vector

| Format                  | Extensions                                     | Notes                                                                    |
| ----------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ |
| GeoJSON                 | `.geojson`, `.json`                            | RFC 7946 (WGS 84) or legacy GeoJSON with a collection-level `crs` member |
| GeoPackage              | `.gpkg`                                        | Preferred GIS export. All layers are merged into one overlay             |
| Zipped shapefile        | `.zip`                                         | Include `.shp`, `.shx`, `.dbf`, and `.prj`                               |
| Zipped File Geodatabase | `.gdb.zip`, or a `.zip` with one `.gdb` folder | ArcGIS / Pro “Export File Geodatabase” zips work                         |
| KML                     | `.kml`                                         | WGS 84 only. KMZ is not accepted — unzip and upload the `.kml`           |

The file picker also allows extra world-file suffixes (`.tfw`, `.gfw`,
`.j2w`). Those do not add formats: JPEG2000, GIF, and a world file next
to a GeoTIFF are not used as a primary.

## Coordinate reference systems

Every upload needs a CRS that GDAL can read. {{FAIMS}} then reprojects:

- **Vectors** to WGS 84 (EPSG:4326) for tiling
- **Rasters** to Web Mercator (EPSG:3857) for image tiles

The field app draws everything on a Web Mercator base map. You do not
pick an output CRS.

### Where the CRS must live

| Format                       | How {{FAIMS}} finds the CRS                                                                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GeoTIFF, GeoPDF              | Embedded in the file. A leftover sibling `.prj` is **ignored** so it cannot relabel a correct image                                                                     |
| PNG / JPEG                   | The `.prj` only (the world file is placement, not a datum). The `.prj` stem must match the image: `plan.png` + `plan.pgw` + `plan.prj`                                  |
| GeoPackage, File Geodatabase | Layer / feature-class spatial reference                                                                                                                                 |
| Shapefile                    | The `.prj` inside the zip                                                                                                                                               |
| GeoJSON                      | RFC 7946 with no `crs` member is treated as WGS 84. Legacy files may include a collection-level `"crs"` member; that is preserved when nested collections are flattened |
| KML                          | Always WGS 84 (lon/lat). Other CRS values are not valid KML                                                                                                             |

There is no EPSG allow-list. A code PROJ cannot transform to 4326 or 3857
fails during processing, and the layer status shows the GDAL message.

### What we definitely support

Use these when you want the least surprise:

- **EPSG:4326** — WGS 84, lon/lat. Default for GeoJSON and KML
- **EPSG:3857** — Web Mercator (the map the app already uses)
- **EPSG:28356** — GDA94 / MGA zone 56 (and the same pattern for other
  GDA94 MGA zones)
- **EPSG:32756** — WGS 84 / UTM zone 56S (and the same pattern for other
  UTM zones)

GDA2020 (for example EPSG:7844, EPSG:7856) should reproject through the
PROJ data shipped with the worker. Prefer a GeoPackage or GeoTIFF; do not
put GDA2020 coordinates in RFC 7946 GeoJSON.

### Axis order and GeoJSON

RFC 7946 GeoJSON is **longitude, latitude** (x, y) in WGS 84. Projected
legacy GeoJSON must include a `"crs"` member on the FeatureCollection,
or the numbers will be read as degrees and the layer will appear in the
wrong place.

KML is the same lon/lat convention. GeoPackage, shapefile, and File
Geodatabase carry axis order in their SRS; ingest reprojects from that.

## File structure

### Raster

**GeoTIFF.** One image, CRS and geotransform inside. Do not add a `.prj`
beside it — it is ignored. Multi-band RGB or RGBA is the usual case.
Very high-latitude extents (beyond about ±85°) cannot be warped to Web
Mercator.

**GeoPDF.** Optional-content groups are all turned on so collar / surround
layers stay visible. Rasterized at GDAL’s guessed DPI (150 if it cannot
tell). Thin linework may look softer than in a GIS viewer.

**PNG / JPEG.** Three files, **same basename**:

```text
excavation-plan.png
excavation-plan.pgw
excavation-plan.prj
```

JPEG uses `.jgw` (or `.wld`) instead of `.pgw`. The world file is the
affine placement; the `.prj` is the CRS. A world file whose name does
not match the image will pass the upload form and fail (or misplace)
during processing.

### Vector

**One overlay per upload.** Every source layer is merged into a single
geometry layer named for drawing only:

- Multi-layer GeoPackage → one overlay
- Multi-folder KML → one overlay
- File Geodatabase feature classes → one overlay
- Mixed Point / Line / Polygon in one file → one overlay

**Attributes, domains, subtypes, relationships, and GDB attachments are
dropped.** Style is a single stroke / fill on the layer, not per-feature
symbology from the GIS.

**Nested GeoJSON.** RFC 7946 forbids a FeatureCollection inside
`features[]`. Some exports still write that. Ingest flattens those
wrappers to leaf Features and keeps the **root** `"crs"` member. A CRS
on a nested collection is ignored.

**Shapefile zip.** Put the shapefile set in the zip (root or a folder).
Required members: `.shp`, `.shx`, `.dbf`, `.prj`. Loose (unzipped)
`.shp` files are rejected. A zip that contains more than one File
Geodatabase is rejected.

**File Geodatabase zip.** Prefer `Name.gdb.zip`, or a zip whose only
`.gdb` folder is the geodatabase. The worker extracts it before
conversion. Uncompressed contents may be at most 8 GB.

**KML.** Upload `.kml`, not `.kmz`. Folders become one overlay.

## What we do not accept

| You might have                        | What to do instead                                                      |
| ------------------------------------- | ----------------------------------------------------------------------- |
| KMZ                                   | Unzip and upload the `.kml`                                             |
| Loose shapefile (`.shp` + sidecars)   | Zip them, including `.prj`                                              |
| Unzipped `.gdb` folder                | Zip the geodatabase                                                     |
| JPEG2000, MrSID, ECW, IMG, ASCII grid | Convert to GeoTIFF                                                      |
| GPX, FlatGeobuf, TopoJSON             | Convert to GeoPackage or GeoJSON                                        |
| MBTiles or PMTiles as the upload      | Those are the _output_. Upload the source GIS file                      |
| A zip of GeoTIFFs                     | Upload one GeoTIFF (or one primary file). A `.zip` is treated as vector |
| More than one primary in one upload   | The first primary file is the one that is processed                     |

A layer that crosses the antimeridian (180°) can fail the geographic
extent check. Clip or split it before upload. Polar rasters that cannot
be represented in Web Mercator will fail or clip.

## What collectors see

After processing, the layer is one PMTiles archive (vector tiles or
lossy WebP image tiles). On a Map field or the {{notebook}} overview map,
collectors can show or hide it, change opacity, and pan to it. They
cannot query attributes or change the source symbology beyond the layer
style.

Only **Ready** layers can be linked and downloaded. Replacing the file
withdraws the current overlay immediately; devices drop the old file on
the next refresh and have a gap until the replacement is Ready.

## Preparing a file (QGIS / ArcGIS)

1. Keep **one theme** per layer (one site plan, one cadastre outline).
2. Confirm the layer has a CRS — not “unknown”.
3. For vectors, **Export** to GeoPackage, or to RFC 7946 GeoJSON in
   WGS 84. For imagery, **Export** / **Save as** GeoTIFF and include the
   CRS in the file.
4. For a shapefile, zip `.shp`, `.shx`, `.dbf`, and `.prj` together.
5. For PNG/JPEG, write a world file and a `.prj` with the **same
   basename** as the image.
6. Stay under 2 GB. Very dense cadastre is thinned at low zoom so the
   tiles stay small; street-scale detail is kept on polygon layers.
