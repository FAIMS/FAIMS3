import {config as baseConfig} from './wdio.conf.ts';
import {getAppUrl, loadE2eEnv} from './test/helpers/env.ts';

loadE2eEnv();

/**
 * Tier 0 smoke suite (test/specs/smoke/**).
 * Uses app baseUrl by default; individual specs navigate absolutely as needed.
 */
export const config = {
  ...baseConfig,
  specs: ['./test/specs/smoke/**/*.ts'],
  baseUrl: getAppUrl(),
  maxInstances: 1,
};
