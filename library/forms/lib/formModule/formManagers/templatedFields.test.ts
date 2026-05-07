import type {UISpecification} from '@faims3/data-model';
import {describe, expect, it} from 'vitest';
import {recomputeDerivedFields} from './templatedFields';

const meta = {
  annotation: {include: false, label: 'annotation'},
  uncertainty: {include: false, label: 'uncertainty'},
};

function makeAddressTemplateSpec(): UISpecification {
  return {
    fields: {
      addr: {
        'component-namespace': 'faims-custom',
        'component-name': 'AddressField',
        'type-returned': 'faims-core::JSON',
        'component-parameters': {
          label: 'Address',
          name: 'addr',
          required: false,
        },
        validationSchema: [['yup.mixed']],
        initialValue: null,
        meta,
        condition: null,
        persistent: false,
        displayParent: false,
      },
      derived: {
        'component-namespace': 'faims-custom',
        'component-name': 'TemplatedStringField',
        'type-returned': 'faims-core::String',
        'component-parameters': {
          label: 'Derived',
          name: 'derived',
          required: false,
          template: 'At: {{addr}}',
        },
        validationSchema: [['yup.string']],
        initialValue: '',
        meta,
        condition: null,
        persistent: false,
        displayParent: false,
      },
    },
    views: {
      'FORM-v1': {
        label: 'Form',
        fields: ['addr', 'derived'],
      },
    },
    viewsets: {
      FORM: {
        label: 'Form',
        views: ['FORM-v1'],
      },
    },
    visible_types: ['FORM'],
  } as UISpecification;
}

describe('recomputeDerivedFields (templateFunction)', () => {
  it('uses AddressField templateFunction so templates show display_name', () => {
    const uiSpecification = makeAddressTemplateSpec();
    const {updates, changes} = recomputeDerivedFields({
      values: {
        addr: {
          display_name: '123 Main St',
          address: {road: 'Main St', house_number: '123'},
        },
      },
      uiSpecification,
      formId: 'FORM',
      context: {},
    });
    expect(changes).toBe(true);
    expect(updates.derived).toBe('At: 123 Main St');
  });

  it('uses display_name from schema-valid address value', () => {
    const uiSpecification = makeAddressTemplateSpec();
    const {updates} = recomputeDerivedFields({
      values: {
        addr: {
          display_name: 'PO Box 1',
          manuallyEnteredAddress: 'PO Box 1',
        },
      },
      uiSpecification,
      formId: 'FORM',
      context: {},
    });
    expect(updates.derived).toBe('At: PO Box 1');
  });

  it('treats null address as empty in templates', () => {
    const uiSpecification = makeAddressTemplateSpec();
    const {updates} = recomputeDerivedFields({
      values: {
        addr: null,
      },
      uiSpecification,
      formId: 'FORM',
      context: {},
    });
    expect(updates.derived).toBe('At: ');
  });
});
