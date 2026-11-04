# API service entrypoints

This folder holds **long-running service processes** for `@faims3/api`. Each
file is a valid runnable entrypoint: start it with `tsx` in development or
`node` against the compiled output in production. They are not one-off CLI
tools; those stay in [`src/scripts/`](../scripts/).

The HTTP API itself is the package `main` at [`src/index.ts`](../index.ts)
(`pnpm start`). Everything else that stays up as its own process lives here.

| Entrypoint           | Process                                                                               | Local                                        | Production (`WORKDIR` `/app/api/build/src`) |
| -------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------- |
| `capacityManager.ts` | Watches the Couch map-asset queue and asks the capacity provider for workers          | `pnpm --filter=@faims3/api capacity-manager` | `node entrypoints/capacityManager.js`       |
| `spatialWorker.ts`   | Claims one map-asset job at a time, runs GDAL / tippecanoe / pmtiles, exits when idle | `pnpm --filter=@faims3/api spatial-worker`   | `node entrypoints/spatialWorker.js --poll`  |

Compose (`docker compose up -d capacity-manager spatial-worker`) and AWS CDK
Fargate tasks start these same files. `CAPACITY_PROVIDER=FIXED` is the local
path; ECS `RunTask` is the production path. See the [API README](../../README.md)
and [Map Layers](../../../docs/developer/docs/source/markdown/MapLayers.md).
