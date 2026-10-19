# Map Layers

How Control Centre map-layer uploads become device-ready PMTiles, how survey
listings expose them, and how field devices keep on-device copies.

Record GeoJSON / KML / GeoPackage export is separate: [Geospatial export pipeline](GeospatialExport.md).

## Ingest

Control Centre uploads are stored as Couch metadata in the `mapassets` database. File bytes go to object storage (AWS S3 in production, local RustFS in `./dev.sh`). Each asset document records the exact location in `storedAttachments` (`provider`, `resourceUri`, content type, byte size, optional S3 `endpoint`) for `original`, companion files, and `normalized`. For S3 the URI is `s3://{region}/{bucket}/{key}`. The combined upload may be at most 2 GB (8 files).

The HTTP request writes files to disk (`multer` disk storage) and returns `201` while the asset is `pending`. After the response, the API streams originals to object storage and deletes the local staging directory. Nothing on that path buffers the whole original in RAM. GDAL does not run in the API process.

A spatial worker then claims the job (`pending` → `processing`), downloads the originals, runs GDAL, and streams the normalized PMTiles archive back to object storage. Workers poll the Couch `pending` / stale-`processing` queue (one asset at a time per process) and exit after `SPATIAL_WORKER_IDLE_EXIT_MS` with no claim (`0` never exits). A capacity manager is the only process that starts workers. It maps total queue depth (`inFlight` + `unclaimed`) through `CAPACITY_SCALE_THRESHOLDS` (`3,8,16,32` by default: 1→2 at 3 jobs, 2→3 at 8, and so on), caps at `CAPACITY_MAX`, and calls a pluggable capacity provider (`ECS`, `FIXED`, or `MOCK`). The provider adds capacity; it does not stop in-flight workers.

On AWS the manager is a small Fargate service (desired 1). It `RunTask`s worker tasks. There is no worker ECS service, so an idle exit is not replaced and compute returns to zero. Locally and on-prem, `CAPACITY_PROVIDER=FIXED` and a compose / always-on worker polls with idle exit disabled.

The field app and Control Centre download the device-ready file directly from object storage. `GET /api/map-assets/:id/download-url` (Bearer) returns a JSON grant (`url`, `mediaType`, `filename`, `byteSize`, `expiresInSeconds`). The client then `GET`s `url` — Conductor does not stream the bytes. Grants last one hour. When the API reaches RustFS on an internal hostname, set `ATTACHMENT_S3_PUBLIC_ENDPOINT` (e.g. `http://localhost:9000`) so the signed host is reachable from the browser. Docker `--all` and the compose API service set that automatically. The bucket allows CORS `GET`/`HEAD` (CDK in AWS; Conductor applies it on local RustFS).

## Local object storage (RustFS)

`./dev.sh` / `./localdev.sh` start RustFS beside CouchDB, plus `capacity-manager` and `spatial-worker` (`docker compose up -d couchdb rustfs capacity-manager spatial-worker`). The worker image (`faims-dev-worker:local`, Dockerfile.dev target `worker`) has GDAL, tippecanoe, and pmtiles, and does not bake application source. Rebuild it with `--build` only when `Dockerfile.dev` or the lockfile changes. Its scratch directory is the `spatial_scratch` volume, not the API container's disk.

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
- PNG or JPEG with a world file and a `.prj`

GDAL must report a CRS. Uploads with no CRS are marked `failed` and no normalized attachment is stored. The failure text is the GDAL message.

Every accepted file becomes one PMTiles archive (`application/vnd.pmtiles`):

- Vectors are reprojected to a geometry-only layer in `EPSG:4326` (`ogr2ogr -f FlatGeobuf -nlt GEOMETRY -t_srs EPSG:4326 -nln features -select ""`), then tiled with `tippecanoe -z 14 --drop-densest-as-needed -l features`. A zipped File Geodatabase is extracted to scratch before ogr2ogr so GDAL does not read through `/vsizip`. Every source layer is written into that one layer, so a multi-folder KML, multi-layer GeoPackage, or File Geodatabase becomes a single overlay. Feature attributes are dropped — the app only draws geometry. The intermediate FlatGeobuf is deleted after tiling.
- Rasters, including georeferenced PDFs, are warped to `EPSG:3857`. A PDF is rasterized at GDAL's default 150 DPI. `gdalwarp` uses `-progress`, `-multi`, `-wm`, and `NUM_THREADS` from config (defaults: 256 MB warp buffer, `ALL_CPUS`). `gdal_translate` and `gdaladdo` also pass `-progress`. GDAL writes WebP MBTiles at the native zoom, `gdaladdo` fills the lower zooms, and `pmtiles convert` writes the archive. The MBTiles file is deleted after conversion. The asset document stores the placement extent plus `minZoom`, `maxZoom`, and `tileSize` (256) from the archive header.

Worker thread / memory knobs (env or CDK `spatialCapacity`): `GDAL_NUM_THREADS` (`ALL_CPUS` or an integer), `GDAL_CACHEMAX` (MB), `GDAL_WARP_MEMORY_MB` (`gdalwarp -wm`), `GDAL_WARP_MULTI`, `TIPPECANOE_MAX_THREADS` (omit = all CPUs). Conservative defaults (256 MB cache and warp buffer) fit a 1 vCPU / 2 GiB worker. Raise cache toward 1024–2048 MB and warp memory toward 1024 MB on an 8 vCPU / 32 GiB task. CDK copies these onto the worker task only.

The worker claims a `pending` asset by setting `status` to `processing` and writing `processingStartedAt`. Stage and progress writes bump `updatedAt`. A job with no stage or progress change for 2 hours is treated as abandoned and may be claimed again. `processingAttempts` counts claims. A fresh claim is left alone. After three claims the asset is marked `failed`. A GDAL error fails the asset immediately and is not retried. Workers do not claim a job until originals are in object storage. Replacing the file returns the asset to `pending` and clears the claim, the attempt count, and the previous object-store pointers.

## Survey listings and on-device copies

`GET /api/directory` (and notebook list/get) attach `contextualLayers`: **ready** linked assets only. Pending, processing, and failed assets are omitted even while the survey link remains.

That array is the field app's keep-set. On directory refresh, an activated survey drops any on-device file whose id is not listed (a file still used by another survey stays). Omitting the fields entirely (manifest attach failure) is the opposite signal: do not treat that as "no layers" and do not delete.

Replace is immediate invalidation, not last-good. After staging succeeds, the previous object-store blobs are gone and the asset leaves the listing until the new file is `ready`. Devices that already hold the old file delete it on the next refresh, then download the new hash when it appears. A withdrawn overlay is not kept as a fallback. This is intentional for now.

## Processing progress

While a job is in progress the asset also carries `processingStage`: a stable step id (`uploading`, `queued`, `downloading`, `extracting-archive`, `interpreting-crs`, `converting-geometries`, `tiling-vectors`, `warping-raster`, `building-tiles`, `building-overviews`, `converting-tiles`, `storing`). During `tiling-vectors`, `processingProgress` holds tippecanoe's phase and percent (`Reordering geometry` / `45`). During `warping-raster`, `building-tiles`, and `building-overviews`, it holds GDAL `-progress` ticks (`Warping` / `45`). Those writes also refresh the processing claim so a long GeoTIFF step is not stolen. `pmtiles convert` (`converting-tiles`) still has no live percent. The Control Centre maps those to short messages (Building vector tiles — Reordering geometry 45%) and polls them with the rest of the asset. Both fields are cleared when the job reaches `ready` or `failed`.

## Implementation

`api/src/couchdb/mapAssets/normalize.ts` and `api/src/couchdb/mapAssets/store.ts` (claim, original upload, GDAL), `api/src/scripts/spatialWorker.ts` (poll until idle), `api/src/scripts/capacityManager.ts` (queue depth → capacity), `api/src/services/capacityProvider.ts` (ECS / FIXED / MOCK). Command helpers live in `api/src/couchdb/export/gdal.ts`. Docker images install GDAL, Poppler, unzip, tippecanoe 2.79.0, and the go-pmtiles 1.28.1 CLI (`pmtiles`). The image build fails unless `gdalinfo --formats` lists PDF, MBTiles, and WEBP. `PMTILES_BIN` and `TIPPECANOE_BIN` override the executable names; `pmtiles` falls back to `go-pmtiles`. GeoPackage export still runs GDAL inside the API process; see [Geospatial export pipeline](GeospatialExport.md).
