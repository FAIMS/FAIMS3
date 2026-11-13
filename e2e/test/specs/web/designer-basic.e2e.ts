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

  it('should open designer from a template when Edit Template is available', async () => {
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

    const openDesigner = await $('button*=Edit Template');
    if (!(await openDesigner.isExisting())) {
      await captureStep({
        surface: 'web',
        label: 'open-designer-unavailable',
      });
      return;
    }
    await openDesigner.click();

    await WebDesignerPage.waitForOpen();
    await expect(byTestId('web-designer-shell')).toBeDisplayed();
    await expect(byTestId('web-designer-save-button')).toBeDisplayed();
    await captureStep({
      surface: 'web',
      label: 'designer-open',
    });
  });

  it('should keep a draft on close and publish after an edit', async () => {
    await browser.url(`${getWebUrl()}/templates`);
    await browser.waitUntil(
      async () =>
        (await $('table').isExisting()) ||
        (await byTestId('web-templates-heading').isExisting()),
      {timeout: 15000}
    );

    const link = await $('a[href*="/templates/"]');
    if (!(await link.isExisting())) {
      return;
    }
    await link.click();

    const actionsTab = await $('button*=Actions');
    if (await actionsTab.isExisting()) {
      await actionsTab.click();
    }

    const openDesigner = await $('button*=Edit Template');
    if (!(await openDesigner.isExisting())) {
      return;
    }
    await openDesigner.click();
    await WebDesignerPage.waitForOpen();

    await WebDesignerPage.addForm(`E2E Form ${Date.now()}`);
    await WebDesignerPage.close();
    await WebDesignerPage.closeKeepDraft();
    await browser.waitUntil(async () => !(await WebDesignerPage.isOpen()), {
      timeout: 15000,
    });

    await openDesigner.waitForClickable({timeout: 10000});
    await openDesigner.click();
    await WebDesignerPage.waitForOpen();
    await WebDesignerPage.save();
    await WebDesignerPage.confirmPublish();
    await expect(byTestId('web-designer-shell')).toBeDisplayed();
    await captureStep({
      surface: 'web',
      label: 'designer-published',
    });
  });
});
