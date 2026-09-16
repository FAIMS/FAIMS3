# FAIMS3 Mobile App

This project contains the code for the FAIMS3 mobile app.

Contact [info@faims.edu.au](mailto:info@faims.edu.au) to enrol to try out the software.

## Capacitor configuration

Capacitor config is generated at prebuild from `capacitor.config.dist.json` into
gitignored `capacitor.config.json` (via `bin/generateCapacitorConfig.sh` /
`pnpm run generate-capacitor-config`, also invoked by `runconfig`). App name and
id come from `VITE_APP_NAME` / `VITE_APP_ID`; ADB live-reload uses
`CAP_ANDROID_ADB_FORWARD` / `CAP_SERVER_URL` (see `adb-guide.md`).

We use JSON rather than `capacitor.config.ts` because Capacitor v7 cannot load a
TypeScript config under TypeScript 7. Once we upgrade to Capacitor v8 (which
fixes that incompatibility), we can return to a `capacitor.config.ts` that reads
env directly and drop this generate-from-dist step.
