import {expect} from 'chai';
import {
  assertGdalAvailable,
  GdalUnavailableError,
  isGdalAvailable,
} from '../src/couchdb/export/gdal';

describe('GDAL availability', () => {
  it('isGdalAvailable returns a boolean', async () => {
    const result = await isGdalAvailable();
    expect(result).to.be.a('boolean');
  });

  it('GdalUnavailableError has a clear message', () => {
    const err = new GdalUnavailableError();
    expect(err.name).to.equal('GdalUnavailableError');
    expect(err.message).to.include('GDAL ogr2ogr is not installed');
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
      expect(err).to.be.instanceOf(GdalUnavailableError);
    }
  });
});
