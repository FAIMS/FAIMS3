/**
 * @file Tests for `fieldEditorRegistry` lookup and `renderFieldEditor` fallback.
 */

import {describe, expect, it} from 'vitest';
import {
  getFieldEditorRenderer,
  renderFieldEditor,
} from './field-editor-registry';
import {BaseFieldEditor} from '../../components/Fields/BaseFieldEditor';
import {TextFieldEditor} from '../../components/Fields/TextFieldEditor';

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

  it('falls back to BaseFieldEditor for unknown components', () => {
    const rendered = renderFieldEditor({
      fieldComponent: 'UnknownFieldComponent',
      context: {
        fieldName: 'field-a',
        viewId: 'section-a',
        viewSetId: 'form-a',
      },
    });

    expect(rendered.type).toBe(BaseFieldEditor);
    expect(rendered.props.fieldName).toBe('field-a');
  });

  it('returns registered editor element for known components', () => {
    const rendered = renderFieldEditor({
      fieldComponent: 'TextField',
      context: {
        fieldName: 'field-b',
        viewId: 'section-a',
        viewSetId: 'form-a',
      },
    });

    expect(rendered.type).toBe(TextFieldEditor);
    expect(rendered.props.fieldName).toBe('field-b');
  });
});
