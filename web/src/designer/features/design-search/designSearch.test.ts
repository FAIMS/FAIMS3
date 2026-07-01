import {describe, expect, test} from 'vitest';
import type {FieldType} from '../../state/initial';
import {buildDesignSearchEntries} from './designSearchUtils';
import {
  findFormForSection,
  findSectionForField,
  getFormTabIndex,
  getSectionIndex,
} from '../navigation/scrollToElements';

const textField = (label: string, id: string): FieldType =>
  ({
    'component-namespace': 'faims-custom',
    'component-name': 'TextField',
    'type-returned': 'faims-core::String',
    'component-parameters': {
      name: id,
      label,
      helperText: '',
      advancedHelperText: '',
    },
    initialValue: '',
  }) as FieldType;

const viewsets = {
  primary: {label: 'Primary Form', views: ['section-a', 'section-b']},
};
const views = {
  'section-a': {
    label: 'General',
    fields: ['field-a'],
    description: 'Main section',
  },
  'section-b': {label: 'Details', fields: ['field-b']},
};
const fields = {
  'field-a': textField('Alpha', 'field-a'),
  'field-b': textField('Beta', 'field-b'),
};

describe('buildDesignSearchEntries', () => {
  test('indexes forms, sections, and fields', () => {
    const entries = buildDesignSearchEntries(viewsets, views, fields);
    expect(entries.map(entry => entry.type)).toEqual([
      'form',
      'section',
      'field',
      'section',
      'field',
    ]);
  });

  test('includes location metadata on field entries', () => {
    const entries = buildDesignSearchEntries(viewsets, views, fields);
    const fieldEntry = entries.find(entry => entry.fieldId === 'field-a');
    expect(fieldEntry?.viewSetLabel).toBe('Primary Form');
    expect(fieldEntry?.sectionLabel).toBe('General');
  });
});

describe('navigation helpers', () => {
  test('resolves form tab index and section ownership', () => {
    expect(getFormTabIndex('primary', ['primary'], [])).toBe(0);
    expect(findFormForSection('section-b', viewsets)).toBe('primary');
    expect(findSectionForField('field-b', views)).toBe('section-b');
    expect(getSectionIndex('section-b', 'primary', viewsets)).toBe(1);
  });
});
