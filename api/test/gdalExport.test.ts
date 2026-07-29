import {describe, expect, it} from 'vitest';
import {
  assertGdalAvailable,
  GdalUnavailableError,
  isGdalAvailable,
} from '../src/couchdb/export/gdal';

describe('GDAL availability', () => {
  it('isGdalAvailable returns a boolean', async () => {
    const result = await isGdalAvailable();
    expect(result).toBeTypeOf('boolean');
  });

  it('GdalUnavailableError has a clear message', () => {
    const err = new GdalUnavailableError();
    expect(err.name).toBe('GdalUnavailableError');
    expect(err.message).toContain('GDAL ogr2ogr is not installed');
  });

  it('assertGdalAvailable matches isGdalAvailable', async () => {
    const available = await isGdalAvailable();

    if (available) {
      await assertGdalAvailable();
      return;
    }

    try {
      await assertGdalAvailable();
      expect.fail('Expected assertGdalAvailable to throw when GDAL is missing');
    } catch (err) {
      expect(err).toBeInstanceOf(GdalUnavailableError);
    }
  });
});
