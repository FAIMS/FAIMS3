/**
 * Overview map tab: a record with a captured point must plot on the map.
 *
 * This is the only coverage of the record-geometry hydration pipeline
 * (`recordFeatures.ts` → `OverviewMap`). The notebook page renders each tab's
 * children only while that tab is selected, so nothing exercises the map until
 * a spec actually navigates to it.
 *
 * The load-bearing assertion is the absence of the "no location data" empty
 * state: that string renders precisely when hydration yields zero features, so
 * it fails if geometry stops being extracted. It does not depend on basemap
 * tiles, which need an API key CI has no secret for — OpenLayers builds its
 * viewport whether or not any tile ever loads.
 */
import {loginAppPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import AppRecordsPage from '../../pageobjects/app-records.ts';

const NO_GEOMETRY_MESSAGE = 'No records with location data found';
const NO_GIS_FIELD_MESSAGE = 'No GIS fields found';
const LOAD_FAILED_MESSAGE = 'Failed to load map data';

describe('App — Notebook overview map', () => {
  const noteText = `E2E map ${Date.now()}`;

  before(async () => {
    await browser.reloadSession();
    await loginAppPersona('projectContributor');
    await AppRecordsPage.ensureNotebookOpen();
  });

  // Record creation is its own example rather than more `before` work: the hook
  // timeout is 60s and login + activation + capture together can approach it.
  it('should create a record carrying a captured point', async () => {
    await AppRecordsPage.createRecordWithPoint(noteText);
    await captureStep({surface: 'app', label: 'record-with-point-created'});
  });

  it('should plot the captured record geometry on the map', async () => {
    await AppRecordsPage.openMapTab();

    // Wait for a terminal state — the map mounted, or an empty/error state
    // rendered — because those branches are mutually exclusive. Polling only
    // for the absence of a message would be satisfied before hydration even
    // begins, letting the assertions below pass vacuously.
    await browser.waitUntil(
      async () => {
        if (await $('.ol-viewport').isExisting()) return true;
        const text = await $('body').getText();
        return (
          text.includes(NO_GEOMETRY_MESSAGE) ||
          text.includes(NO_GIS_FIELD_MESSAGE) ||
          text.includes(LOAD_FAILED_MESSAGE)
        );
      },
      {
        timeout: 30000,
        timeoutMsg: 'Overview map never reached a terminal state',
      }
    );

    const body = await $('body').getText();
    expect(body).not.toContain(NO_GIS_FIELD_MESSAGE);
    expect(body).not.toContain(NO_GEOMETRY_MESSAGE);
    expect(body).not.toContain(LOAD_FAILED_MESSAGE);
    await expect($('.ol-viewport')).toExist();

    await captureStep({surface: 'app', label: 'overview-map-with-record'});
  });
});
