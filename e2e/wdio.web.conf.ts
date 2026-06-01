import {config as baseConfig} from './wdio.conf.ts';

/**
 * WebdriverIO configuration for the web management dashboard (web/).
 *
 * Differences from the base config:
 *  - specs scoped to test/specs/web/**
 *  - baseUrl points to the web dashboard (default: http://localhost:3001)
 *  - Only Desktop and Wide viewports are relevant for the dashboard
 *
 * Set WEB_URL env var to override the dashboard URL.
 * Set VIEWPORT=desktop|wide (default: desktop) to control the screenshot size.
 */
export const config = {
  ...baseConfig,
  specs: ['./test/specs/web/**/*.ts'],
  baseUrl: process.env.WEB_URL || 'http://localhost:3001',
};
