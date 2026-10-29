module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  // @faims3/build-config is an ESM workspace dep (symlinked under node_modules
  // to library/build-config). Exclude the @faims3 scope from the node_modules
  // ignore pattern so @swc/jest transforms its `export` statements to CJS for
  // the (CJS) jest runtime.
  transformIgnorePatterns: ['/node_modules/(?!(@faims3)/)'],
  transform: {
    '^.+\\.tsx?$': ['@swc/jest', {configFile: './.swcrc'}],
    // The ESM @faims3/build-config dep is .js - transform it too (CJS output).
    '^.+\\.jsx?$': ['@swc/jest', {configFile: './.swcrc'}],
  },
};
