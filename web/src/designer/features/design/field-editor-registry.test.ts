import {describe, expect, it} from 'vitest';
import {getFieldEditorRenderer} from './field-editor-registry';

describe('field editor registry', () => {
  it('contains renderers for core field components', () => {
    expect(getFieldEditorRenderer('TextField')).toBeTypeOf('function');
    expect(getFieldEditorRenderer('Select')).toBeTypeOf('function');
    expect(getFieldEditorRenderer('MultiSelect')).toBeTypeOf('function');
    expect(getFieldEditorRenderer('TemplatedStringField')).toBeTypeOf(
      'function'
    );
  });

  it('returns undefined for unknown field components', () => {
    expect(getFieldEditorRenderer('UnknownFieldComponent')).toBeUndefined();
  });
});
