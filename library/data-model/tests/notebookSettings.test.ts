import {NotebookSettingsSchema} from '../src/uiSpecification/types';

describe('NotebookSettingsSchema', () => {
  it('keeps a setting it does not declare, for the owning module to read', () => {
    const parsed = NotebookSettingsSchema.parse({
      showQrCodeButton: true,
      'my-module/enabled': true,
    });

    expect(parsed.showQrCodeButton).toBe(true);
    expect(parsed).toHaveProperty('my-module/enabled', true);
  });

  it('still requires the settings it declares', () => {
    const parsed = NotebookSettingsSchema.safeParse({
      'my-module/enabled': true,
    });

    expect(parsed.success).toBe(false);
  });
});
