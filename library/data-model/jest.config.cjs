/** @type {import('jest').Config} */
const fs = require('node:fs');
const path = require('node:path');

const swcrc = JSON.parse(
  fs.readFileSync(path.join(__dirname, '.swcrc'), 'utf8')
);
((swcrc.jsc ??= {}).experimental ??= {}).plugins = [
  ['@swc-contrib/mut-cjs-exports', {}],
];

module.exports = {
  testEnvironment: 'node',
  testPathIgnorePatterns: ['build'],
  transform: {
    '^.+\\.tsx?$': ['@swc/jest', swcrc],
  },
};
