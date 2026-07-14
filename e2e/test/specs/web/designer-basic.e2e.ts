/**
 * Open designer from a seeded template Actions tab when possible.
 */
import {loginWebPersona} from '../../helpers/auth.ts';
import {captureStep} from '../../helpers/screenshot.ts';
import {byTestId} from '../../helpers/selectors.ts';
import {getWebUrl} from '../../helpers/env.ts';
import WebDesignerPage from '../../pageobjects/web/web-designer.ts';

describe('Web Dashboard — Designer basic', () => {
  before(async () => {
    await browser.reloadSession();
    await loginWebPersona('redMemberCreator');
  });

  it('should open designer from a template when Open in Editor is available', async () => {
    await browser.url(`${getWebUrl()}/templates`);
    await browser.waitUntil(
      async () =>
        (await $('table').isExisting()) ||
        (await byTestId('web-templates-heading').isExisting()),
      {timeout: 15000}
    );

    const link = await $('a[href*="/templates/"]');
    if (!(await link.isExisting())) {
      await captureStep({
        surface: 'web',
        label: 'no-template-link',
      });
      return;
    }
    await link.click();

    const actionsTab = await $('button*=Actions');
    if (await actionsTab.isExisting()) {
      await actionsTab.click();
    }

    const openEditor = await $('button*=Editor');
    if (!(await openEditor.isExisting())) {
      await captureStep({
        surface: 'web',
        label: 'open-editor-unavailable',
      });
      return;
    }
    await openEditor.click();

    await WebDesignerPage.waitForOpen();
    await expect(byTestId('web-designer-shell')).toBeDisplayed();
    await expect(byTestId('web-designer-save-button')).toBeDisplayed();
    await captureStep({
      surface: 'web',
      label: 'designer-open',
    });
  });
});
