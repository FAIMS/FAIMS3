import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import {advancedSelectFieldSpec} from '../fieldRegistry/fields/AdvancedSelect';
import {addressFieldSpec} from '../fieldRegistry/fields/AddressField';
import {audioRecorderFieldSpec} from '../fieldRegistry/fields/AudioRecorder';
import {checkboxFieldSpec} from '../fieldRegistry/fields/CheckboxField';
import {
  computedNumberSpec,
  computedTextSpec,
} from '../fieldRegistry/fields/ComputedFields';
import {
  datePickerFieldSpec,
  dateTimePickerFieldSpec,
  monthPickerFieldSpec,
} from '../fieldRegistry/fields/DateFields';
import {fileUploaderFieldSpec} from '../fieldRegistry/fields/FileUploader';
import {mapFieldSpec} from '../fieldRegistry/fields/MapField';
import {multiSelectFieldSpec} from '../fieldRegistry/fields/MultiSelect';
import {numberFieldSpec} from '../fieldRegistry/fields/NumberField';
import {percentageSliderFieldSpec} from '../fieldRegistry/fields/PercentageSlider';
import {qrCodeFieldSpec} from '../fieldRegistry/fields/QRCodeFormField';
import {radioGroupFieldSpec} from '../fieldRegistry/fields/RadioGroup';
import {relatedRecordFieldSpec} from '../fieldRegistry/fields/RelatedRecord';
import {selectFieldSpec} from '../fieldRegistry/fields/SelectField';
import {takePhotoFieldSpec} from '../fieldRegistry/fields/TakePhoto';
import {TAKE_PHOTO_REQUIRED_MESSAGE} from '../fieldRegistry/fields/TakePhoto/valueSchema';
import {takePointFieldSpec} from '../fieldRegistry/fields/TakePoint';
import {templatedStringFieldSpec} from '../fieldRegistry/fields/TemplatedStringField';
import {
  emailFieldSpec,
  textFieldSpec,
} from '../fieldRegistry/fields/TextFields';
import {
  collectFieldErrorMessages,
  humanizeValidationMessage,
} from './readableErrors';

const RAW_ZOD_MESSAGE =
  /expected (array|string|object|boolean|number)|invalid input|invalid option|received undefined|received null/i;

const choiceProps = {
  ElementProps: {options: [{value: 'yes', label: 'Yes'}]},
};

type Case = {
  name: string;
  /** Only schema generation is exercised; avoid FieldInfo variance on `component`. */
  spec: {
    name: string;
    fieldDataSchemaFunction?: (props: any) => z.ZodType;
  };
  props: Record<string, unknown>;
  requiredMessage: string;
  /** Generated values may be empty even when the notebook marks them required. */
  allowsAbsentWhenRequired?: boolean;
  /** Values that must fail when the field is required. */
  absentValues: unknown[];
  valid: unknown;
  invalid?: {value: unknown; message: RegExp | string};
};

const cases: Case[] = [
  {
    name: 'TextField',
    spec: textFieldSpec,
    props: {},
    requiredMessage: 'This field is required',
    absentValues: [undefined, null, ''],
    valid: 'Ada',
    invalid: {value: 12, message: /valid text/i},
  },
  {
    name: 'Email',
    spec: emailFieldSpec,
    props: {},
    requiredMessage: 'This field is required',
    absentValues: [undefined, null, ''],
    valid: 'ada@example.com',
    invalid: {value: 'not-an-email', message: 'Enter a valid email address'},
  },
  {
    name: 'Select',
    spec: selectFieldSpec,
    props: choiceProps,
    requiredMessage: 'Please select an option',
    absentValues: [undefined, null, ''],
    valid: 'yes',
    invalid: {value: 'nope', message: /select/i},
  },
  {
    name: 'RadioGroup',
    spec: radioGroupFieldSpec,
    props: choiceProps,
    requiredMessage: 'Please select an option',
    absentValues: [undefined, null, ''],
    valid: 'yes',
    invalid: {value: 'nope', message: /select/i},
  },
  {
    name: 'MultiSelect',
    spec: multiSelectFieldSpec,
    props: choiceProps,
    requiredMessage: 'Please select at least one option',
    absentValues: [undefined, null, []],
    valid: ['yes'],
    invalid: {value: ['nope'], message: /select/i},
  },
  {
    name: 'AdvancedSelect',
    spec: advancedSelectFieldSpec,
    props: {},
    requiredMessage: 'Please select an option',
    absentValues: [undefined, null, ''],
    valid: 'path',
    invalid: {value: 4, message: /select|valid/i},
  },
  {
    name: 'Checkbox',
    spec: checkboxFieldSpec,
    props: {},
    requiredMessage: 'This field is required',
    absentValues: [undefined, null, false],
    valid: true,
    invalid: {value: 'yes', message: /yes or no|valid/i},
  },
  {
    name: 'NumberField',
    spec: numberFieldSpec,
    props: {numberType: 'integer', min: 1, max: 10},
    requiredMessage: 'Please enter a valid whole number',
    absentValues: [undefined, null],
    valid: 4,
    invalid: {value: 1.5, message: 'Please enter a valid whole number'},
  },
  {
    name: 'PercentageSlider',
    spec: percentageSliderFieldSpec,
    props: {min: 0, max: 100, step: 10},
    requiredMessage: 'Please select a valid percentage',
    absentValues: [undefined, null],
    valid: 20,
    invalid: {value: 'high', message: 'Please select a valid percentage'},
  },
  {
    name: 'DatePicker',
    spec: datePickerFieldSpec,
    props: {},
    requiredMessage: 'This field is required',
    absentValues: [undefined, null, ''],
    valid: '2024-01-02',
    invalid: {value: 1, message: /date|valid/i},
  },
  {
    name: 'DateTimePicker',
    spec: dateTimePickerFieldSpec,
    props: {},
    requiredMessage: 'This field is required',
    absentValues: [undefined, null, ''],
    valid: '2024-01-02T03:04',
  },
  {
    name: 'MonthPicker',
    spec: monthPickerFieldSpec,
    props: {},
    requiredMessage: 'This field is required',
    absentValues: [undefined, null, ''],
    valid: '2024-01',
  },
  {
    name: 'QRCode',
    spec: qrCodeFieldSpec,
    props: {},
    requiredMessage: 'This field is required',
    absentValues: [undefined, null, ''],
    valid: 'payload',
    invalid: {value: 9, message: /valid text/i},
  },
  {
    name: 'FileUploader',
    spec: fileUploaderFieldSpec,
    props: {maximum_number_of_files: 1},
    requiredMessage: 'At least one attachment is required',
    absentValues: [undefined, null, []],
    valid: ['file-1'],
    invalid: {value: 'file-1', message: /file|valid/i},
  },
  {
    name: 'AudioRecorder',
    spec: audioRecorderFieldSpec,
    props: {maximumNumberOfRecordings: 1},
    requiredMessage: 'At least one audio recording is required.',
    absentValues: [undefined, null, []],
    valid: ['rec-1'],
    invalid: {value: 'rec-1', message: /recording|valid/i},
  },
  {
    name: 'TakePhoto',
    spec: takePhotoFieldSpec,
    props: {},
    requiredMessage: TAKE_PHOTO_REQUIRED_MESSAGE,
    absentValues: [undefined, null, []],
    valid: ['photo-1'],
    invalid: {value: 'photo-1', message: /photo|valid/i},
  },
  {
    name: 'TakePoint',
    spec: takePointFieldSpec,
    props: {},
    requiredMessage: 'A location is required',
    absentValues: [undefined, null],
    valid: {
      type: 'Feature',
      properties: {
        timestamp: 1,
        altitude: null,
        speed: null,
        heading: null,
        accuracy: 5,
        altitude_accuracy: null,
      },
      geometry: {type: 'Point', coordinates: [0, 0]},
    },
    invalid: {value: {type: 'nope'}, message: /location|valid/i},
  },
  {
    name: 'Map',
    spec: mapFieldSpec,
    props: {center: [0, 0]},
    requiredMessage: 'A location selection is required.',
    absentValues: [undefined, null],
    valid: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {type: 'Point', coordinates: [0, 0]},
          properties: null,
        },
      ],
    },
    invalid: {
      value: {type: 'FeatureCollection', features: []},
      message: /location/i,
    },
  },
  {
    name: 'Address',
    spec: addressFieldSpec,
    props: {},
    requiredMessage: 'Address is required',
    absentValues: [undefined, null],
    valid: {display_name: '1 High Street'},
    invalid: {value: {display_name: '   '}, message: 'Address is required'},
  },
  {
    name: 'RelatedRecord',
    spec: relatedRecordFieldSpec,
    props: {},
    requiredMessage: 'At least one related record is required.',
    absentValues: [undefined, null, []],
    valid: [{record_id: 'rec', relation_type_vocabPair: ['a', 'b']}],
    invalid: {value: [{record_id: ''}], message: /related|valid/i},
  },
  {
    name: 'ComputedNumber',
    spec: computedNumberSpec,
    props: {expression: '{A}'},
    requiredMessage: 'This value could not be computed yet.',
    absentValues: [undefined, null],
    valid: 3,
  },
  {
    name: 'ComputedText',
    spec: computedTextSpec,
    props: {expression: '{A}'},
    requiredMessage: 'This value could not be computed yet.',
    absentValues: [undefined, null],
    valid: 'done',
  },
  {
    name: 'TemplatedString',
    spec: templatedStringFieldSpec,
    props: {template: '{A}'},
    requiredMessage: 'Enter valid text',
    absentValues: [],
    valid: 'rendered',
    invalid: {value: 12, message: 'Enter valid text'},
    allowsAbsentWhenRequired: true,
  },
];

function schemaFor(entry: Case, required: boolean) {
  const generate = entry.spec.fieldDataSchemaFunction;
  if (!generate) {
    throw new Error(`${entry.name} has no value schema`);
  }
  const schema = generate({...entry.props, required});
  // Match FormValidation.getFieldSchema: optional fields may be missing.
  return required ? schema : schema.nullable().optional();
}

/** Messages as the form manager would show them under a field. */
function interfaceMessages(schema: z.ZodType, value: unknown): string[] {
  const parsed = z.object({field: schema}).safeParse({field: value});
  if (parsed.success) return [];
  return Object.values(collectFieldErrorMessages(parsed.error.issues));
}

function expectHuman(messages: string[]) {
  expect(messages.length).toBeGreaterThan(0);
  for (const message of messages) {
    expect(message).not.toMatch(RAW_ZOD_MESSAGE);
    expect(message.trim().length).toBeGreaterThan(0);
  }
}

describe('field validation error messages', () => {
  it('covers every field that validates a value', () => {
    const covered = new Set(cases.map(entry => entry.spec.name));
    const validating = [
      textFieldSpec,
      emailFieldSpec,
      selectFieldSpec,
      radioGroupFieldSpec,
      multiSelectFieldSpec,
      advancedSelectFieldSpec,
      checkboxFieldSpec,
      numberFieldSpec,
      percentageSliderFieldSpec,
      datePickerFieldSpec,
      dateTimePickerFieldSpec,
      monthPickerFieldSpec,
      qrCodeFieldSpec,
      fileUploaderFieldSpec,
      audioRecorderFieldSpec,
      takePhotoFieldSpec,
      takePointFieldSpec,
      mapFieldSpec,
      addressFieldSpec,
      relatedRecordFieldSpec,
      computedNumberSpec,
      computedTextSpec,
      templatedStringFieldSpec,
    ];
    for (const spec of validating) {
      expect(covered.has(spec.name)).toBe(true);
    }
  });

  describe.each(cases)('$name', entry => {
    const required = schemaFor(entry, true);
    const optional = schemaFor(entry, false);

    it('shows a human required message when the value is missing from the form', () => {
      const parsed = z.object({field: required}).safeParse({});
      if (entry.allowsAbsentWhenRequired) {
        expect(parsed.success).toBe(true);
        return;
      }
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const messages = Object.values(
          collectFieldErrorMessages(parsed.error.issues)
        );
        expectHuman(messages);
        expect(messages[0]).toBe(entry.requiredMessage);
      }
    });

    it('shows a human message for empty and absent values', () => {
      if (entry.allowsAbsentWhenRequired) {
        for (const value of [undefined, null, '']) {
          expect(interfaceMessages(required, value)).toEqual([]);
        }
        return;
      }
      for (const value of entry.absentValues) {
        const messages = interfaceMessages(required, value);
        expectHuman(messages);
        expect(messages[0]).toBe(entry.requiredMessage);
      }
    });

    it('accepts a valid value when required', () => {
      expect(required.safeParse(entry.valid).success).toBe(true);
    });

    it('accepts an absent value when optional', () => {
      expect(optional.safeParse(undefined).success).toBe(true);
      expect(optional.safeParse(null).success).toBe(true);
      expect(z.object({field: optional}).safeParse({}).success).toBe(true);
    });

    if (entry.invalid) {
      it('shows a human message for an invalid value', () => {
        const messages = interfaceMessages(required, entry.invalid!.value);
        expectHuman(messages);
        const expected = entry.invalid!.message;
        if (expected instanceof RegExp) {
          expect(messages[0]).toMatch(expected);
        } else {
          expect(messages[0]).toBe(expected);
        }
      });
    }
  });

  it('keeps a file-count limit message when too many files are attached', () => {
    const schema = schemaFor(
      cases.find(entry => entry.name === 'FileUploader')!,
      true
    );
    const messages = interfaceMessages(schema, ['a', 'b']);
    expect(messages[0]).toBe('Maximum 1 file allowed');
  });

  it('rewrites a raw Zod type error before it reaches the field', () => {
    expect(
      humanizeValidationMessage(
        'Invalid input: expected array, received undefined'
      )
    ).toBe('This field is required');
    const shown = collectFieldErrorMessages([
      {
        path: ['photos', 0],
        message: 'Invalid option: expected one of "a"|"b"',
      },
    ]);
    expect(shown).toEqual({photos: 'Please select a valid option'});
  });
});
