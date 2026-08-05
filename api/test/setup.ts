/**
 * Shared Vitest setup for API unit tests (runs before every test file).
 *
 * 1. PouchDB memory adapter — must be registered before any DB code opens a
 *    database with `{adapter: 'memory'}`. Individual tests still call
 *    `PouchDB.plugin(...)` themselves; this is an early registration for
 *    import-order safety.
 *
 * 2. Express async-error Layer patch (`patchExpressAsync.js`) — that module
 *    replaces `Layer.prototype.handle` with a setter that wraps async route
 *    handlers so rejections call `next(err)`. The setter must be installed
 *    before any Layer gets a handler assigned. Route modules also import the
 *    patch, but Vitest can evaluate the app graph against a different Express
 *    copy unless Express is kept external (see vitest.config.ts). Loading the
 *    patch here first targets Node's require-cached Express Layer before tests
 *    import routes. The patch is idempotent if loaded again later.
 *
 * Paths resolve from the api/ package root (`pnpm --filter=@faims3/api test`
 * and vitest.config.ts run with cwd = api/). Avoid `import.meta` here: api
 * tsconfig emits CJS and rejects it (TS1470).
 */
import {createRequire} from 'node:module';
import path from 'node:path';
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';

const nodeRequire = createRequire(path.join(process.cwd(), 'package.json'));

// eslint-disable-next-line @typescript-eslint/no-require-imports
PouchDB.plugin(nodeRequire('pouchdb-adapter-memory'));
PouchDB.plugin(PouchDBFind);

nodeRequire('./src/utils/patchExpressAsync.js');
