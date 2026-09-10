/**
 * Tests for config schema validation, especially addressAutosuggest + map source
 * key rules (MapTiler key required in one of two places when source is MAPTILER).
 */
import {ZodError} from 'zod';
import {
  DEFAULT_EXPORT_RATE_LIMITER_PER_WINDOW,
  DEFAULT_EXPORT_RATE_LIMITER_WINDOW_MS,
  SecurityConfigSchema,
  UiConfiguration,
} from '../lib/config';

function minimalOfflineMaps(
  overrides: {
    mapSource?: 'osm' | 'maptiler';
    mapSourceKey?: string;
  } = {}
) {
  return {
    mapSource: 'maptiler' as const,
    mapSourceKey: 'map-key',
    offlineMaps: false,
    mapStyle: 'basic' as const,
    ...overrides,
  };
}

function minimalUiConfig(overrides: Record<string, unknown> = {}) {
  return {
    uiTheme: 'default' as const,
    notebookListType: 'tabs' as const,
    notebookName: 'survey',
    appName: 'Test App',
    appId: 'FAIMS',
    offlineMaps: minimalOfflineMaps(),
    addressAutosuggest: {source: 'NONE' as const},
    ...overrides,
  };
}

describe('UiConfiguration addressAutosuggest + MapTiler key validation', () => {
  it('accepts MAPTILER when maptilerKey is set', () => {
    const config = minimalUiConfig({
      addressAutosuggest: {
        source: 'MAPTILER',
        maptilerKey: 'autosuggest-key',
      },
    });
    expect(() => UiConfiguration.parse(config)).not.toThrow();
  });

  it('accepts MAPTILER when mapSource is maptiler and mapSourceKey is set (no maptilerKey)', () => {
    const config = minimalUiConfig({
      offlineMaps: minimalOfflineMaps({
        mapSource: 'maptiler',
        mapSourceKey: 'map-key',
      }),
      addressAutosuggest: {source: 'MAPTILER'},
    });
    expect(() => UiConfiguration.parse(config)).not.toThrow();
  });

  it('rejects MAPTILER when neither maptilerKey nor map source key is provided (mapSource is osm)', () => {
    const config = minimalUiConfig({
      offlineMaps: minimalOfflineMaps({
        mapSource: 'osm',
        mapSourceKey: undefined,
      }),
      addressAutosuggest: {source: 'MAPTILER'},
    });
    expect(() => UiConfiguration.parse(config)).toThrow(ZodError);
    try {
      UiConfiguration.parse(config);
    } catch (e) {
      const err = e as ZodError;
      expect(err.message).toContain('MAPTILER');
      expect(err.message).toMatch(/maptilerKey|mapSource|mapSourceKey/);
    }
  });

  it('rejects MAPTILER when mapSource is maptiler but mapSourceKey is missing', () => {
    const config = minimalUiConfig({
      offlineMaps: minimalOfflineMaps({
        mapSource: 'maptiler',
        mapSourceKey: undefined,
      }),
      addressAutosuggest: {source: 'MAPTILER'},
    });
    expect(() => UiConfiguration.parse(config)).toThrow(ZodError);
  });

  it('rejects MAPTILER when mapSource is maptiler but mapSourceKey is empty string', () => {
    const config = minimalUiConfig({
      offlineMaps: minimalOfflineMaps({
        mapSource: 'maptiler',
        mapSourceKey: '',
      }),
      addressAutosuggest: {source: 'MAPTILER'},
    });
    expect(() => UiConfiguration.parse(config)).toThrow(ZodError);
  });

  it('rejects MAPTILER when maptilerKey is empty string and mapSourceKey is not set', () => {
    const config = minimalUiConfig({
      offlineMaps: minimalOfflineMaps({
        mapSource: 'osm',
        mapSourceKey: undefined,
      }),
      addressAutosuggest: {source: 'MAPTILER', maptilerKey: ''},
    });
    expect(() => UiConfiguration.parse(config)).toThrow(ZodError);
  });

  it('uses map source key when maptilerKey is whitespace-only and mapSource has key', () => {
    const config = minimalUiConfig({
      offlineMaps: minimalOfflineMaps({
        mapSource: 'maptiler',
        mapSourceKey: 'map-key',
      }),
      addressAutosuggest: {source: 'MAPTILER', maptilerKey: '   '},
    });
    expect(() => UiConfiguration.parse(config)).not.toThrow();
  });
});

describe('UiConfiguration enablePlansInDesigner', () => {
  it('defaults to true when omitted', () => {
    const parsed = UiConfiguration.parse(minimalUiConfig());
    expect(parsed.enablePlansInDesigner).toBe(true);
  });

  it('accepts an explicit false', () => {
    const parsed = UiConfiguration.parse(
      minimalUiConfig({enablePlansInDesigner: false})
    );
    expect(parsed.enablePlansInDesigner).toBe(false);
  });
});

describe('SecurityConfigSchema export rate limiter', () => {
  it('applies export limiter defaults when omitted', () => {
    const parsed = SecurityConfigSchema.parse({});
    expect(parsed.exportRateLimiterEnabled).toBe(true);
    expect(parsed.exportRateLimiterWindowMs).toBe(
      DEFAULT_EXPORT_RATE_LIMITER_WINDOW_MS
    );
    expect(parsed.exportRateLimiterPerWindow).toBe(
      DEFAULT_EXPORT_RATE_LIMITER_PER_WINDOW
    );
  });

  it('accepts an explicit override', () => {
    const parsed = SecurityConfigSchema.parse({
      exportRateLimiterEnabled: false,
      exportRateLimiterWindowMs: 3_600_000,
      exportRateLimiterPerWindow: 50,
    });
    expect(parsed.exportRateLimiterEnabled).toBe(false);
    expect(parsed.exportRateLimiterWindowMs).toBe(3_600_000);
    expect(parsed.exportRateLimiterPerWindow).toBe(50);
  });
});
