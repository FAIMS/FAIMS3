# Map Layers

How Control Centre map-layer uploads become device-ready PMTiles, how survey
listings expose them, and how field devices keep on-device copies.

Record GeoJSON / KML / GeoPackage export is separate: [Geospatial export pipeline](GeospatialExport.md).

## Ingest

Control Centre uploads are stored as Couch metadata in the `mapassets` database. File bytes go to object storage (AWS S3 in production, local RustFS in `./dev.sh`). Each asset document records the exact location in `storedAttachments` (`provider`, `resourceUri`, content type, byte size, optional S3 `endpoint`) for `original`, companion files, and `normalized`. For S3 the URI is `s3://{region}/{bucket}/{key}`. The combined upload may be at most 2 GB (8 files).

The HTTP request writes files to disk (`multer` disk storage) and returns `201` while the asset is `pending`. After the response, the API streams originals to object storage and deletes the local staging directory. That live upload is bounded to 2 hours and marks the asset `failed` itself if it overruns; a background sweep does the same for uploads abandoned by a crash or reload. A late object-store put does not write onto a failed or replaced document, and does not delete the replacement's staging files. Nothing on that path buffers the whole original in RAM. GDAL does not run in the API process.

A spatial worker then claims the job (`pending` → `processing`), downloads the originals, runs GDAL, and streams the normalized PMTiles archive back to object storage. Workers poll the Couch `pending` / stale-`processing` queue (one asset at a time per process) and exit after `SPATIAL_WORKER_IDLE_EXIT_MS` with no claim (`0` never exits). A capacity manager is the only process that starts workers. It maps total queue depth (`inFlight` + `unclaimed`) through `CAPACITY_SCALE_THRESHOLDS` (`3,8,16,32` by default: 1→2 at 3 jobs, 2→3 at 8, and so on), caps at `CAPACITY_MAX`, and calls a pluggable capacity provider (`ECS`, `FIXED`, or `MOCK`). If the oldest unclaimed job has waited at least `CAPACITY_STARVATION_MS` (default 5 minutes; `0` disables), the manager asks for one extra worker above the depth step. Further extras from that same stale job are spaced by `CAPACITY_SCALE_IN_COOLDOWN_MS` (default twice the starvation timeout; `0` keeps only the first extra). Worker count never exceeds `CAPACITY_MAX` or the number of jobs in the queue. The provider adds capacity; it does not stop in-flight workers.

On AWS the manager is a small Fargate service (desired 1). It `RunTask`s worker tasks. There is no worker ECS service, so an idle exit is not replaced and compute returns to zero. Locally and on-prem, `CAPACITY_PROVIDER=FIXED` and a compose / always-on worker polls with idle exit disabled.

The field app and Control Centre download the device-ready file directly from object storage. `GET /api/map-assets/:id/download-url` (Bearer) returns a JSON grant (`url`, `mediaType`, `filename`, `byteSize`, `expiresInSeconds`). The client then `GET`s `url` — Conductor does not stream the bytes. Grants last one hour. When the API reaches RustFS on an internal hostname, set `ATTACHMENT_S3_PUBLIC_ENDPOINT` (e.g. `http://localhost:9000`) so the signed host is reachable from the browser. Docker `--all` and the compose API service set that automatically. The bucket allows CORS `GET`/`HEAD` (CDK in AWS; Conductor applies it on local RustFS).

## Local object storage (RustFS)

`./dev.sh` / `./localdev.sh` start CouchDB and RustFS first, migrate Couch, then start `capacity-manager` and `spatial-worker`. The worker image (`faims-dev-worker:local`, Dockerfile.dev target `worker`) has GDAL, tippecanoe, and pmtiles, and does not bake application source. Rebuild it with `--build` only when `Dockerfile.dev` or the lockfile changes. Its scratch directory is the `spatial_scratch` volume, not the API container's disk.

| Service | URL                                |
| ------- | ---------------------------------- |
| S3 API  | http://localhost:9000              |
| Console | http://localhost:9001              |
| Health  | `GET http://localhost:9000/health` |

`api/.env.dist` points Conductor at that endpoint with static local keys (`faimsdev` / `faimsdevsecret1`). `./localdev.sh --all` overrides `ATTACHMENT_S3_ENDPOINT` to `http://rustfs:9000` so the API container uses Docker DNS, and `ATTACHMENT_S3_PUBLIC_ENDPOINT` to `http://localhost:9000` so presigned downloads work from the host browser. On AWS ECS, omit the keys and endpoint — the task role authenticates, and CDK creates the bucket with CORS for client GETs.

Admin smoke test (operations / general admin): `POST /api/admin/test-attachment-storage`. It uploads, heads, downloads, presigns, and deletes a tiny probe object.

The storage backend is selected like email: `ATTACHMENT_STORAGE_TYPE=S3` or `MOCK` (forced under test). Implementation: `api/src/services/attachmentStorageService.ts`.

A rejected or aborted upload deletes its `req-*` staging directory: multer size/count errors and a client disconnect both clean up. Before the stream starts, the API checks free space on `os.tmpdir()`. If less than three times the 2 GB cap remains (room for the original plus a copy while it uploads to object storage), it returns **503** with `MAP_ASSET_UPLOAD_BUSY_MESSAGE`. The Control Centre shows that text rather than a generic failure. AWS Conductor ephemeral storage defaults to **21 GiB**. GDAL scratch is on the spatial worker task (`spatialCapacity.ephemeralStorageGiB`, default **80**, range 21–200).

Node 18+ defaults `server.requestTimeout` to 5 minutes, which would abort a slow 2 GB upload. Conductor sets `requestTimeout` to 1 hour (`headersTimeout` slightly higher). That is a process-wide HTTP server setting, not per-route. An AWS ALB idle timeout is still typically 60 seconds: a continuously sending upload stays alive; a paused upload can still be cut. DigitalOcean nginx in this repo sets `client_max_body_size 0` but inherits the default 60s `proxy_read_timeout` unless you raise it.

## Accepted uploads

- GeoJSON (`.geojson`, `.json`)
- GeoPackage (`.gpkg`)
- Zipped shapefile, including `.shp`, `.shx`, `.dbf`, and `.prj`
- Zipped ESRI File Geodatabase (`.gdb.zip`, or a `.zip` with one `.gdb` folder). GDAL OpenFileGDB reads it; ArcGIS / Pro "Export File Geodatabase" zips work. A zip with more than one `.gdb` is rejected. Feature classes are merged into one layer. Domains, subtypes, relationships, and attachments are dropped.
- KML (`.kml`)
- GeoTIFF (`.tif`, `.tiff`)
- Georeferenced PDF (`.pdf`)
- PNG or JPEG with a world file and a `.prj`. A sibling `.prj` is assigned only for those images (`-a_srs` onto a VRT). GeoTIFF and GeoPDF keep their embedded CRS; a leftover `.prj` is ignored.

GDAL must report a CRS. Uploads with no CRS are marked `failed` and no normalized attachment is stored. The failure text is the GDAL message. GeoJSON is opened with `-oo RFC7946=NO` so a legacy collection-level `crs` member is honoured. Flatten copies that root `crs` onto the rewritten FeatureCollection before `ogrinfo` / `ogr2ogr`.

Every accepted file becomes one PMTiles archive (`application/vnd.pmtiles`):

- Vectors are reprojected to a geometry-only layer in `EPSG:4326`. Homogeneous Point, Line, or Polygon layers become FlatGeobuf (`ogr2ogr -f FlatGeobuf -nlt PROMOTE_TO_MULTI`). `-explodecollections` is omitted on that path: combined with `PROMOTE_TO_MULTI` it makes FlatGeobuf a Polygon layer then writes MultiPolygon features (`ICreateFeature: Mismatched geometry type`), which is the usual File Geodatabase polygon class. Mixed or unknown layers (a GeoJSON `GeometryCollection`, MultiLineString beside polygons, multi-folder KML) become RFC 8142 GeoJSONSeq (`-explodecollections` so collection members become ordinary features), because tippecanoe's FlatGeobuf reader rejects header type 0 (`Unknown`) for those geometries. Then `tippecanoe -l features` with family-specific thinning: polygons `-z 16 --hilbert --drop-fraction-as-needed --drop-polygons --drop-rate=3 --base-zoom=10 --maximum-tile-bytes=80000 --simplification=10 --simplify-only-low-zooms --extend-zooms-if-still-dropping` (drop, do not `--coalesce`: attributes are stripped, so coalesce would dissolve neighbouring parcels at every zoom, including street scale; fraction dropping instead of `--coalesce-smallest-as-needed`, which tippecanoe 2.78+ exits 100 on when the area threshold cannot increase); points `-z 14 --drop-densest-as-needed --drop-rate=g --maximum-tile-bytes=80000 --maximum-tile-features=5000 --hilbert --extend-zooms-if-still-dropping`; lines and mixed/unknown layers `-z 14 --drop-densest-as-needed --extend-zooms-if-still-dropping`. Extra zoom levels are added only when a tile at that family max zoom still overflows after dropping. A zipped File Geodatabase is extracted to scratch before ogr2ogr so GDAL does not read through `/vsizip`. GeoJSON FeatureCollection items that are themselves FeatureCollections are flattened to leaf Features before ogrinfo/ogr2ogr; `-explodecollections` does not walk that nesting. Every source layer is written into that one layer, so a multi-folder KML, multi-layer GeoPackage, or File Geodatabase becomes a single overlay. Feature attributes are dropped — the app only draws geometry. The intermediate file is deleted after tiling.
- Rasters, including georeferenced PDFs, are warped to `EPSG:3857`. A PDF is rasterized at GDAL's guessed DPI (150 fallback) with `-oo LAYERS=ALL` so optional-content collar / surround groups stay on. `gdalwarp` uses `-multi`, `-wm`, and `NUM_THREADS` from config (defaults: 256 MB warp buffer, `ALL_CPUS`). Progress ticks are the default `GDALTermProgress` stdout (these tools have no `-progress` flag). GDAL writes WebP MBTiles (`QUALITY=90`; the MBTiles driver has no lossless WebP) at the native zoom, `gdaladdo` fills the lower zooms, and `pmtiles convert` writes the archive. The MBTiles file is deleted after conversion. The asset document stores the placement extent plus `minZoom`, `maxZoom`, and `tileSize` (256) from the archive header.

Worker thread / memory knobs (env or CDK `spatialCapacity`): `GDAL_NUM_THREADS` (`ALL_CPUS` or an integer), `GDAL_CACHEMAX` (MB), `GDAL_WARP_MEMORY_MB` (`gdalwarp -wm`), `GDAL_WARP_MULTI`, `TIPPECANOE_MAX_THREADS` (omit = all CPUs). Conservative defaults (256 MB cache and warp buffer) fit a 1 vCPU / 2 GiB worker. Raise cache toward 1024–2048 MB and warp memory toward 1024 MB on an 8 vCPU / 32 GiB task. CDK copies these onto the worker task only.

The worker claims a `pending` asset by setting `status` to `processing` and writing `processingStartedAt`. The first processing write sets `processingHeartbeatMs`; later claim, stage, and progress writes refresh it. `updatedAt` is the last user-facing document change (create, rename, replace, ready/failed) and is what listings sort by. A job with no processing heartbeat for 2 hours is treated as abandoned and may be claimed again. `processingAttempts` counts claims. A fresh claim is left alone. After three claims the asset is marked `failed`. A GDAL error fails the asset immediately and is not retried. Workers do not claim a job until originals are in object storage. The live original upload times itself out after 2 hours from start and reports `failed`; the API process also sweeps `pending` uploads that still have no stored originals after 2 hours from `originalUploadStartedMs` (set on create and replace; a rename does not reset that clock) so a crash after the 201 can still be replaced. Replacing the file returns the asset to `pending`, stamps a new `originalUploadStartedMs`, and clears the claim, the attempt count, the heartbeat, and the previous object-store pointers.

## Survey listings and on-device copies

`GET /api/directory` (and notebook list/get) attach `contextualLayers`: **ready** linked assets only. Pending, processing, and failed assets are omitted even while the survey link remains.

That array is the field app's keep-set. On directory refresh, an activated survey drops any on-device file whose id is not listed (a file still used by another survey stays). Omitting the fields entirely (manifest attach failure) is the opposite signal: do not treat that as "no layers" and do not delete.

Replace is immediate invalidation, not last-good. After staging succeeds, the previous object-store blobs are gone and the asset leaves the listing until the new file is `ready`. Devices that already hold the old file delete it on the next refresh, then download the new hash when it appears. A withdrawn overlay is not kept as a fallback. This is intentional for now.

## Processing progress

While a job is in progress the asset also carries `processingStage`: a stable step id (`uploading`, `queued`, `downloading`, `extracting-archive`, `flattening-geojson`, `interpreting-crs`, `converting-geometries`, `tiling-vectors`, `warping-raster`, `building-tiles`, `building-overviews`, `converting-tiles`, `storing`). During `flattening-geojson`, `processingProgress` is bytes consumed (`Flattening` / `45`), including while a large geometry or a nested collection is scanned (`features` before `type` is walked in one pass). During `tiling-vectors`, it holds tippecanoe's phase and percent (`Reordering geometry` / `45`). During `warping-raster`, `building-tiles`, and `building-overviews`, it holds GDALTermProgress ticks (`Warping` / `45`). Those writes also refresh the processing claim so a long GeoTIFF step is not stolen. `pmtiles convert` (`converting-tiles`) still has no live percent. The Control Centre maps those to short messages (Building vector tiles — Reordering geometry 45%) and polls them with the rest of the asset. Both fields are cleared when the job reaches `ready` or `failed`.

## Implementation

`api/src/couchdb/mapAssets/normalize.ts` and `api/src/couchdb/mapAssets/store.ts` (claim, original upload, GDAL), `api/src/scripts/spatialWorker.ts` (poll until idle), `api/src/scripts/capacityManager.ts` (queue depth / staleness → capacity), `api/src/services/capacityProvider.ts` (ECS / FIXED / MOCK). Command helpers live in `api/src/couchdb/export/gdal.ts`. Docker images install GDAL, Poppler, unzip, tippecanoe 2.79.0, and the go-pmtiles 1.28.1 CLI (`pmtiles`). The image build fails unless `gdalinfo --formats` lists PDF, MBTiles, and WEBP. `PMTILES_BIN` and `TIPPECANOE_BIN` override the executable names; `pmtiles` falls back to `go-pmtiles`. GeoPackage export still runs GDAL inside the API process; see [Geospatial export pipeline](GeospatialExport.md).
