# Map layers

Map layers are georeferenced overlays that collectors can download onto a
device and show on maps in the field. Use them for site plans, excavation
grids, satellite or drone imagery, cadastral boundaries, or any other
spatial context that should sit on top of the base map.

They are not the same as an **Offline Map** region. An Offline Map region
is a patch of base-map street tiles. A map layer is a file you upload,
prepare, and then link to one or more {{notebooks}}.

Who can upload, edit, replace, or delete a layer is controlled by team
membership and ownership. See [Roles and Permissions](../core/permissions.md).

## Upload a layer

1. Open **Map layers** in the left sidebar (under Management)
2. Click **Add map layer**
3. Give the layer a short name and, if useful, a description
4. Choose a team to own the layer. Team is required unless you are a Super
   User, who may leave it blank to keep the layer as their own
5. Attach the georeferenced file (or files) and click **Add map layer**

The combined upload may be at most 2 GB and 8 files. Every file must
have a coordinate reference system (CRS) that {{FAIMS}} can read.
Uploads with no CRS fail processing and cannot be used on devices.

Accepted formats (prefer GeoPackage or GeoTIFF when you can):

| Kind       | Formats                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| **Raster** | GeoTIFF (`.tif`, `.tiff`); georeferenced PDF (`.pdf`); PNG or JPEG with a world file and `.prj`         |
| **Vector** | GeoJSON (`.geojson`, `.json`); GeoPackage (`.gpkg`); zipped shapefile or File Geodatabase; KML (`.kml`) |

For a zipped shapefile include `.shp`, `.shx`, `.dbf`, and `.prj`. A File
Geodatabase should be a `.gdb.zip` (or a zip that contains one `.gdb`
folder). Feature attributes are not shown in the app — vector layers draw
geometry only.

GIS staff: see [Map layer formats and coordinate systems](map-layer-formats.md)
for CRS, file structure, and what we do not accept.

## Processing

After the upload is accepted, the layer is prepared for devices. Status
on the layer's **Details** tab moves through:

| Status         | Meaning                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------- |
| **Pending**    | Waiting for a worker to start                                                                 |
| **Processing** | Being converted. A short stage message is shown (for example _Building vector tiles_)         |
| **Ready**      | Device-ready. You can preview it and link it to {{notebooks}}                                 |
| **Failed**     | Could not be prepared. The failure text (often a missing CRS) is shown under the status badge |

Only **Ready** layers appear for linking and for download on devices.
Pending, processing, and failed layers stay in the library but are omitted
from the {{notebook}} listing the app uses.

Open a layer to see **Details**, **Preview**, **Linked {{Notebooks}}**,
and (if you can change it) **Actions**.

## Link a layer to a {{notebook}}

Collectors only see a layer after it is linked to a {{notebook}} they
activate. Linking is a {{notebook}} manager action. Anyone who can open
that {{notebook}} (including Guest) can then download the layer, even if
they cannot see it in the Map layers library.

Link from either place:

- The layer's **Linked {{Notebooks}}** tab — use **Link** on a {{notebook}}
  you administer
- The {{notebook}}'s **Map layers** tab — add a ready layer from your
  library

Unlink from the same screens. Unlinking does not delete the library
entry.

## Use layers on a device

When you [activate a {{notebook}}](../data-collection/activating-notebooks.md)
that has ready linked layers, the app asks which ones to download
(**Download map layers**). You can take all of them, a selection, or none.
Downloads need a network connection; after that the files stay on the
device for offline use.

If your deployment shows **Offline Maps** in the app menu (☰), that
screen has two cards:

- **Map regions** — base-map street tiles for an area you draw
- **Map layers** — overlays linked to activated {{notebooks}}; download,
  update, or remove them here

On a Map field, the notebook overview map, or other maps in the app,
open the layers control to show or hide downloaded overlays, change
opacity, and pan to a layer.

A layer that is replaced or unlinked is dropped from the device on the
next refresh. The app does not keep the previous file as a fallback.

## Replace or delete a layer

On the layer's **Actions** tab (shown only if you can change the layer):

- **Edit details** — rename the layer or update the description
- **Replace file** — upload a new georeferenced file. {{Notebook}} links
  are kept. The current overlay is withdrawn immediately: devices delete
  the old file on their next refresh, and there is a gap with no overlay
  until the replacement is **Ready**
- **Delete** — remove the layer from the library and from every
  {{notebook}} that uses it
