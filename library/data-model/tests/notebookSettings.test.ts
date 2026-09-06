import {
  CompiledNotebookUiSpecSchema,
  NotebookSettingsSchema,
  NotebookUiSpecSchema,
} from '../src/uiSpecification/types';

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

/**
 * What a consumer actually parses. Both are intersections of a passthrough
 * model with an object carrying `settings`, so both sides produce `settings`
 * and zod has to merge them; that is what carries the undeclared key, not the
 * settings schema alone.
 */
describe('a notebook ui spec carrying an undeclared setting', () => {
  const uiSpec = {
    fields: {},
    views: {},
    viewsets: {},
    visible_types: [],
    schemaVersion: '1',
    settings: {showQrCodeButton: true, 'my-module/enabled': true},
  };

  it.each([
    ['NotebookUiSpecSchema', NotebookUiSpecSchema],
    ['CompiledNotebookUiSpecSchema', CompiledNotebookUiSpecSchema],
  ])('keeps it through %s', (_name, schema) => {
    const parsed = schema.parse(uiSpec);

    expect(parsed.settings.showQrCodeButton).toBe(true);
    expect(parsed.settings).toHaveProperty('my-module/enabled', true);
  });
});
