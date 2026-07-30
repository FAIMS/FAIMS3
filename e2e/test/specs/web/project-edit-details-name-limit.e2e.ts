/**
 * Project Actions — the shared survey-name minimum length
 * (RESOURCE_NAME_MIN_LENGTH = 5) is enforced when editing survey details.
 *
 * Covers the enforcement added to the edit-details form: previously the create
 * form bounded the name but editing did not. managerBlue is PROJECT_MANAGER on
 * the Blue project, which grants UPDATE_PROJECT_DETAILS.
 *
 * Two bounds are deliberately not exercised through the UI and belong in a
 * schema-level test instead:
 * - the maximum: the input carries a `maxLength` attribute, so the browser
 *   prevents typing past it and a UI test cannot reach the server-side cap;
 * - trimming (a spaces-only name): WebDriver does not deliver a spaces-only
 *   value into this input, so the case cannot be driven reliably here.
 */
import {loginWebPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {waitForTestId} from '../../helpers/wait.ts';
import {getWebUrl} from '../../helpers/env.ts';

/** Mirrors INPUT_LIMITS.RESOURCE_NAME_MIN_LENGTH. */
const MIN_LENGTH = 5;

/** Open the Blue project and switch to its Actions tab. */
async function openBlueProjectActions() {
  await browser.url(`${getWebUrl()}/projects`);
  await waitForTestId('web-projects-heading', {timeout: 15000});
  const search = byTestId('web-data-table-search');
  if (await search.isExisting()) {
    await search.setValue('Blue');
  }
  const row = await $('tbody tr');
  await row.waitForClickable({timeout: 15000});
  await row.click();
  await browser.waitUntil(
    async () => (await browser.getUrl()).match(/\/projects\/[^/]+/) !== null,
    {timeout: 10000}
  );
  const actionsTab = await $('button*=Actions');
  await actionsTab.waitForClickable({timeout: 10000});
  await actionsTab.click();
}

/** Open the "Edit name & description" dialog; returns the name input. */
async function openEditDetailsDialog() {
  await openBlueProjectActions();
  await waitForTestId('web-project-edit-details-button', {timeout: 10000});
  await byTestId('web-project-edit-details-button').click();
  await waitForTestId('web-project-edit-details-name', {timeout: 10000});
  return byTestId('web-project-edit-details-name');
}

/**
 * Replace the pre-filled name. The field already holds the current name, so it
 * must be cleared first — setValue alone appends, which would silently leave a
 * valid (long) name and make a rejection test pass for the wrong reason. The
 * value is asserted so that premise can never fail silently again.
 */
async function replaceName(
  input: ReturnType<typeof byTestId>,
  value: string
): Promise<void> {
  await input.clearValue();
  if (value.length > 0) await input.setValue(value);
  await expect(input).toHaveValue(value);
}

/**
 * Replace the name using real keystrokes: select-all, then type (or Delete for
 * an empty value). Needed for the empty case, which `setValue('')` cannot
 * express and `clearValue` alone does not achieve on this controlled input
 * (React restores the previous value).
 */
async function selectAllAndType(
  input: ReturnType<typeof byTestId>,
  value: string
): Promise<void> {
  await input.click();
  await browser.keys(['Control', 'a']);
  if (value.length === 0) {
    await browser.keys('Delete');
  } else {
    await browser.keys(value);
  }
  await expect(input).toHaveValue(value);
}

async function submitDetails() {
  await byTestId('web-project-edit-details-submit').click();
}

/**
 * Assert the form blocked the update: the minimum-length message is shown and
 * the dialog is still open, which means no request was sent.
 */
async function expectRejectedForMinLength(context: string) {
  const dialog = byTestId('web-project-edit-details-dialog');
  await browser.waitUntil(
    async () =>
      (await dialog.getText()).includes(
        `must be at least ${MIN_LENGTH} characters`
      ),
    {
      timeout: 10000,
      timeoutMsg: `Expected a minimum-length validation error for ${context}`,
    }
  );
  await expect(dialog).toBeDisplayed();
}

/** Close the dialog without saving. */
async function dismissDialog() {
  await browser.keys('Escape');
}

describe('Web — Project edit details name length', () => {
  // Captured so the accepted-rename case can put the seeded name back.
  let originalName = '';

  before(async () => {
    await browser.reloadSession();
    await loginWebPersona('managerBlue');
    const input = await openEditDetailsDialog();
    originalName = await input.getValue();
    await dismissDialog();
  });

  after(async () => {
    // Safety net: restore the seeded name if any case left it changed, so this
    // spec is repeatable and does not leak state into other specs.
    if (!originalName) return;
    const input = await openEditDetailsDialog();
    if ((await input.getValue()) !== originalName) {
      await replaceName(input, originalName);
      await submitDetails();
    } else {
      await dismissDialog();
    }
  });

  it('rejects a name well below the minimum length', async () => {
    const input = await openEditDetailsDialog();
    await replaceName(input, 'abc');
    await submitDetails();
    await expectRejectedForMinLength('a 3-character name');
    await captureStep({surface: 'web', label: 'edit-details-name-too-short'});
  });

  it('rejects a name one character below the minimum length', async () => {
    const input = await openEditDetailsDialog();
    await replaceName(input, 'abcd');
    await submitDetails();
    await expectRejectedForMinLength('a 4-character name');
  });

  it('rejects an empty name', async () => {
    const input = await openEditDetailsDialog();
    await selectAllAndType(input, '');
    await submitDetails();
    await expectRejectedForMinLength('an empty name');
  });

  it('accepts a name at the minimum length and saves it', async () => {
    // Keeps "Blue" so the projects-list search still finds the row afterwards.
    const acceptedName = 'Blue';
    expect(acceptedName.length).toBe(MIN_LENGTH - 1);
    const newName = `${acceptedName}5`;

    const input = await openEditDetailsDialog();
    await replaceName(input, newName);
    await submitDetails();

    // Saving closes the dialog.
    const dialog = byTestId('web-project-edit-details-dialog');
    await dialog.waitForDisplayed({
      reverse: true,
      timeout: 15000,
      timeoutMsg: 'Expected the dialog to close after a valid rename',
    });

    // Re-open to confirm the new name persisted, then restore the seeded name.
    const reopened = await openEditDetailsDialog();
    await expect(reopened).toHaveValue(newName);
    await captureStep({surface: 'web', label: 'edit-details-name-accepted'});

    await replaceName(reopened, originalName);
    await submitDetails();
    await dialog.waitForDisplayed({
      reverse: true,
      timeout: 15000,
      timeoutMsg: 'Expected the dialog to close after restoring the name',
    });
  });
});
