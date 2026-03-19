# Feature Service API (ESRI-compatible)

## Overview

The Feature Service API exposes notebook spatial data in an **ESRI-compatible** REST format so that clients such as **ArcGIS** (ArcGIS Online, ArcGIS Pro), **QGIS**, and other GIS tools can consume layers and query features as GeoJSON. Use this when you need to:

- Add a notebook’s spatial data as a layer in ArcGIS or QGIS
- Publish an endpoint that implements a feature service for a survey/notebook
- Consume GeoJSON features with full record attributes from external tools

The API is **stateless** and uses the **same JWT authentication** as the Records CRUD API. Each request must include a Bearer token; record-level visibility (“my records” vs “all records”) is enforced when querying layers.

## Base URL and authentication

All endpoints are under:

```
/api/notebooks/:id/FeatureServer
```

- **:id** is the **project (notebook) ID**.
- **Authentication**: every request must include a short-lived access token (see [Long-lived-tokens](Long-lived-tokens.md)):

```
Authorization: Bearer <access_token>
```

The same token used for `/api/notebooks/:id/records` works for the Feature Server. Project-level permission required is at least `READ_MY_PROJECT_RECORDS`; only records the user is allowed to read (via the same rules as the records API) are included when querying a layer.

## Layer model

- **One layer per form/viewset** that has at least one spatial field (Take Point or Map Field).
- Each **feature** in a layer is **one field’s spatial response**; its attributes are the **full form record** (so a record with multiple spatial elements appears as multiple features in the same layer with the same attributes).
- Layers are ordered by viewset ID; layer IDs are stable integers (0, 1, 2, …).

## Endpoints

### Service root

**GET** `/api/notebooks/:id/FeatureServer`

Returns ESRI-style service metadata: list of layers and spatial reference.

**Response** (200 OK): JSON with `currentVersion`, `serviceDescription`, `layers` (array of `{ id, name }`), and `spatialReference` (e.g. WGS84, wkid 4326).

---

### Service info

**GET** `/api/notebooks/:id/FeatureServer/info`

Returns the same service metadata as the service root. Some ESRI-compatible clients (e.g. OpenLayers, Digital Atlas) request this endpoint to discover the service. Responds with the same JSON as the service root.

---

### Layer metadata

**GET** `/api/notebooks/:id/FeatureServer/:layerId`

Returns metadata for a single layer: `id`, `name`, `geometryType`, `spatialReference`, and `fields` (attribute schema). A layer may contain mixed geometry types (e.g. point and polygon) when the form has both Take Point and Map Field.

**Response** (200 OK): JSON with layer definition. **404** if `layerId` is invalid or out of range.

---

### Query layer (GeoJSON)

**GET** `/api/notebooks/:id/FeatureServer/:layerId/query`

Returns features for the layer as a **GeoJSON FeatureCollection**. Only records the user is allowed to read are included.

**Query parameters**:

| Parameter           | Type   | Description                                                                  |
| ------------------- | ------ | ---------------------------------------------------------------------------- |
| `f`                 | string | Output format: `geojson` (default) or `json`. Use `geojson` for GIS clients. |
| `where`             | string | Optional attribute filter (reserved for future use).                         |
| `returnGeometry`    | string | `true` (default) or `false`.                                                 |
| `resultOffset`      | number | Number of features to skip (pagination).                                     |
| `resultRecordCount` | number | Maximum number of features to return (pagination).                           |

**Response** (200 OK): `Content-Type: application/geo+json`; body is a GeoJSON FeatureCollection. Each feature has `geometry` (Point, LineString, Polygon, etc.) and `properties` containing the full record (e.g. `record_id`, `revision_id`, `type`, `hrid`, `geometry_source_field_id`, plus all form field values).

**Example**:

```
GET /api/notebooks/my-project-id/FeatureServer/0/query?f=geojson
Authorization: Bearer <access_token>
```

## Using the endpoint in GIS clients

1. **ArcGIS**: Add Layer from URL → type the service root URL (e.g. `https://<host>/api/notebooks/<projectId>/FeatureServer`). If the client requires a token, use the same Bearer token (e.g. in ArcGIS Pro or via a custom authentication option where supported).
2. **QGIS**: Add ArcGIS Feature Server Layer → paste the same base URL. Configure authentication if the server requires it.
3. **Scripts / curl**: Send `Authorization: Bearer <token>` on every request; use the query endpoint with `f=geojson` to fetch a layer’s features.

## Troubleshooting

**TerriaJS / Digital Atlas requests `f=pbf` or `resultType=tile` and gets 400**

The service supports only **JSON** and **GeoJSON** (`supportedQueryFormats: "JSON, geoJSON"`). It does not support PBF or tile-based queries. Some clients (e.g. TerriaJS) may ignore `supportedQueryFormats` and request PBF; the server returns **400** with a JSON error suggesting `f=geojson`. Configure the client to use the GeoJSON format for this service, or use a client that respects `supportedQueryFormats`. Layer metadata also includes `advancedQueryCapabilities` (e.g. `supportsPagination: true`, `supportsResultType: false`) to improve discovery.

**QGIS shows the service (layer list) but won't add any layers**

- The service root (e.g. `GET …/FeatureServer`) can be cached or loaded once; adding a layer triggers extra requests to `…/FeatureServer/:layerId` and `…/FeatureServer/:layerId/query`. Those require the same authentication. If QGIS is not sending a Bearer token, those requests return **401 Unauthorized** and the layer fails to load.
- **Option A (testing only):** In the API `.env`, set `DISABLE_FEATURE_SERVER_AUTH=true` so the Feature Server accepts unauthenticated requests. Use only for local/testing (e.g. QGIS on localhost).
- **Option B:** Configure authentication in QGIS for the Feature Server URL (e.g. Basic or custom header with `Authorization: Bearer <your_token>`), so every request includes the token.

## Related

- [Records CRUD API](RecordsCRUDApi.md) — same auth and project/record permissions.
- [Long-lived-tokens](Long-lived-tokens.md) — obtaining a JWT for API access.
