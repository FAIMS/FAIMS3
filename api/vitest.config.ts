import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    testTimeout: 15_000,
    // Shared in-memory PouchDB / Express app singletons are not isolation-safe
    // across parallel workers. Keep Mocha's single-process sequential behaviour.
    fileParallelism: false,
    pool: 'forks',
    maxWorkers: 1,
    hookTimeout: 30_000,
    server: {
      deps: {
        // Keep Express on Node's require cache so patchExpressAsync and
        // expressSetup share the same Layer prototype (async error forwarding).
        external: ['express'],
      },
    },
  },
});
