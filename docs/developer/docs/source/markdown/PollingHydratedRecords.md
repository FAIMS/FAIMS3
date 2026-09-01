# Reference architecture for a FAIMS3 'real-time dashboard'

A pattern for live dashboards, maps, and other read-only clients that want a notebook in the browser without Couch sync.

Poll `GET /api/notebooks/:id/records/hydrated` for records newer than your last timestamp, upsert them into an in-memory or disk-backed store, then do spatial / SQL / UI work against that store. This is cheap enough to do from a browser now that listing is time-indexed and the hydrated list returns field values in one shot.

Contracts: [Records CRUD API](RecordsCRUDApi.md), [Long-lived tokens](Long-lived-tokens.md).

```
poll  GET …/records/hydrated?updatedAfter=<ms>
        ↓ page while nextStartKey is set
upsert  Map / IndexedDB / DuckDB-WASM / …
        ↓
query   map, charts, filters — local only
```

One worked example of this is a Vite dashboard that walks a notebook into DuckDB-WASM and drives a MapLibre map.

## The loop

1. `GET /api/notebooks/:id/records/hydrated?updatedAfter=<ms>&filterDeleted=false`
2. Keep requesting while `nextStartKey` is set (even if this page is empty — filters run after the DB page).
3. Upsert live rows; drop rows marked `deleted`.
4. When the window drains (`nextStartKey` absent), set the checkpoint to the max `updated` you saw.
5. Sleep, repeat.

First pass uses `updatedAfter=0` and walks everything the token can see. After that, each poll is “what changed since then”.

`updatedAfter` is exclusive epoch milliseconds (`record.updated > this`). `startKey` is only for paging a burst — do not bump `updatedAfter` until the window is drained, or you skip rows that share a timestamp with the last page.

When a time bound is set, `nextStartKey` is a JSON cursor as a string `[updatedMs, recordId]`, not a bare record id.

Hydrated pages are fat (full `data` per row). Keep `limit` modest (around 50) and cap pages per tick so a backfill does not overwhelm the tab.

## Local store

Key by `recordId`. Upsert on `revisionId` / `updated` so an edit replaces the row instead of doubling it. Geometry lives on TakePoint / MapFormField **field values**, not as a record-level coordinate — extract it at ingest if you need points, polygons, or hex bins.

After that, pans, filters, and charts should hit the store, not the API.

Memory is fine for a session. IndexedDB or DuckDB-WASM with browser persistence if you want it to survive reload. Persist the watermark with the data so a refresh continues instead of walking from `0`.

Occasionally reconcile (truncate, reset watermark, walk again) if you need to prove the upserts are idempotent or to recover from a botched cursor.

## Auth

Long-lived tokens are not Bearer tokens for record routes. Exchange them:

```
POST /api/auth/exchange-long-lived-token
{ "token": "<long-lived>" }  →  { "token": "<access JWT>" }
```

Access JWTs last on the order of five minutes. Cache the JWT, refresh a bit early, and re-exchange once on `401`. Sending the long-lived token as `Authorization: Bearer` on `/records/…` will 401.

Do not put the long-lived token in a `VITE_` / `import.meta.env` variable or a frontend bundle. Hold it on a small backend or dev-server proxy and inject the short-lived JWT on proxied `/api/*` (and Couch, if you fetch attachments that way).

Alternatively, you can use the normal login flow (user/pass -> access token -> regular refresh) - however you'll need to ensure CORS allows this in your API, and that your API is configured with an allowed redirect whitelist for your deployed dashboard.

The token user needs `READ_ALL_PROJECT_RECORDS` (plus `READ_PROJECT_METADATA`) if the client is meant to see the whole notebook. A `READ_MY` token still returns 200 — just a subset. See [PermissionModel](PermissionModel.md).

## Attachments

The hydrated payload has attachment **metadata only** (`attachmentId`, `filename`, `fileType` on each field). Bytes are a separate HTTP request. There is no “download this attachment” route on the Records API.

Typical on-demand fetch against the project data DB (`data-<notebookId>`), using the same access JWT:

```
GET /{data-db}/{attachmentId}/{attachmentName}
```

FAIMS stores the blob under the same name as the `att-…` document id. If that 404s, read the stub and take the first `_attachments` key.

Do not pull binaries during the poll. Fetch when a user opens a record (and cache the blob if you want). For a one-shot dump, use the notebook [export](RecordsCRUDApi.md) ZIP instead.
