import {
  coerceShowQrCodeButton,
  deriveRootDescription,
  buildSurveyNotebookDefinitionFromLegacy,
  OLD_DESCRIPTION_MAX_LENGTH,
} from '../src/data_storage/migrations/uiSpecificationMigration';
import {CURRENT_NOTEBOOK_UI_SCHEMA_VERSION} from '../src/uiSpecification/normalize';

/** Legacy wire-format fixture: `api/notebooks/sample_notebook.legacy.json` */

describe('uiSpecificationMigration helpers', () => {
  describe('coerceShowQrCodeButton', () => {
    it('enables QR search only for true and the string "true"', () => {
      expect(coerceShowQrCodeButton(true)).toBe(true);
      expect(coerceShowQrCodeButton('true')).toBe(true);
      expect(coerceShowQrCodeButton(false)).toBe(false);
      expect(coerceShowQrCodeButton('false')).toBe(false);
      expect(coerceShowQrCodeButton(undefined)).toBe(false);
      expect(coerceShowQrCodeButton('1')).toBe(false);
      expect(coerceShowQrCodeButton('yes')).toBe(false);
    });
  });

  describe('deriveRootDescription', () => {
    it('prefers description over pre_description', () => {
      expect(
        deriveRootDescription({
          description: 'Short',
          pre_description: 'Long markdown',
        })
      ).toBe('Short');
    });

    it('caps legacy description to OLD_DESCRIPTION_MAX_LENGTH', () => {
      const long = 'x'.repeat(OLD_DESCRIPTION_MAX_LENGTH + 100);
      expect(deriveRootDescription({description: long})).toBe(
        `${'x'.repeat(OLD_DESCRIPTION_MAX_LENGTH)}…`
      );
    });

    it('does not cap pre_description used as root fallback', () => {
      const long = 'y'.repeat(OLD_DESCRIPTION_MAX_LENGTH + 50);
      expect(deriveRootDescription({pre_description: long})).toBe(long);
    });
  });

  describe('buildSurveyNotebookDefinitionFromLegacy', () => {
    it('maps derived-from and drops template_id from custom', () => {
      const def = buildSurveyNotebookDefinitionFromLegacy({
        legacyMetadata: {
          schema_version: '3.0',
          notebook_version: '1.0',
          pre_description: 'Purpose',
          'derived-from': 'template-abc',
          template_id: 'template-abc',
          extra_flag: true,
        },
        encodedUiSpec: {
          fields: {},
          fviews: {},
          viewsets: {},
          visible_types: [],
        },
      });

      expect(def.metadata.information.derivedFromTemplateId).toBe(
        'template-abc'
      );
      expect(def.metadata.custom).toEqual({extra_flag: true});
      expect(def.metadata.custom).not.toHaveProperty('template_id');
      expect(def.uiSpec.views).toEqual({});
      expect(def.uiSpec).not.toHaveProperty('fviews');
      expect(def.uiSpec.schemaVersion).toBe(CURRENT_NOTEBOOK_UI_SCHEMA_VERSION);
    });
  });
});
