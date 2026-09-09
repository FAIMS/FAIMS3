/**
 * Permanent survey delete writes a tombstone; GET /api/tombstones/:id exposes it.
 */
import {loginWebPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {
  createArchiveAndDeleteNotebook,
  getTombstone,
  getWebAuthSession,
} from '../../helpers/seed.ts';

describe('Web — Project delete tombstone', () => {
  const surveyName = `E2E Tombstone ${Date.now()}`;

  before(async () => {
    await browser.reloadSession();
    await loginWebPersona('redMemberCreator');
  });

  it('should expose a tombstone after permanent survey delete', async () => {
    const {token} = await getWebAuthSession();
    const {notebookId} = await createArchiveAndDeleteNotebook({
      name: surveyName,
      token,
    });

    const tombstone = await getTombstone(notebookId, token);
    expect(tombstone.status).toBe(200);
    expect(tombstone.ok).toBe(true);
    const body = tombstone.body as {
      _id?: string;
      name?: string;
      deletedBy?: string;
      deletedAt?: number;
    };
    expect(body._id).toBe(notebookId);
    expect(body.name).toBe(surveyName);
    expect(typeof body.deletedBy).toBe('string');
    expect(typeof body.deletedAt).toBe('number');

    await captureStep({
      surface: 'web',
      label: 'tombstone-after-delete',
    });
  });

  it('should return 404 when no tombstone exists for an id', async () => {
    const {token} = await getWebAuthSession();
    const missing = await getTombstone(
      `nonexistent-tombstone-${Date.now()}`,
      token
    );
    expect(missing.status).toBe(404);
    expect(missing.ok).toBe(false);

    await captureStep({
      surface: 'web',
      label: 'tombstone-not-found',
    });
  });
});
