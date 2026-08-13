/*
 * Copyright 2026 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: parentDependency.test.ts
 * Description:
 *   Tests for parent-dependency detection over a uiSpec (#2245).
 */

import {
  getParentDependentFieldsForForm,
  getParentDependentForms,
  UiSpecModel,
} from '../src';

// Minimal uiSpec: a parent form (Grid-Square) with a Child-relation
// RelatedRecordSelector targeting a child form (Layer). Field definitions are
// spread in per test.
const makeUiSpec = (
  childFields: Record<string, object>,
  childFieldIds: string[]
): UiSpecModel =>
  ({
    fields: {
      'Square-Name': {
        'component-name': 'TextField',
        'type-returned': 'faims-core::String',
      },
      'Layer-Children': {
        'component-name': 'RelatedRecordSelector',
        'component-parameters': {
          related_type: 'Layer',
          relation_type: 'faims-core::Child',
        },
      },
      ...childFields,
    },
    views: {
      'Grid-Square-View': {fields: ['Square-Name', 'Layer-Children']},
      'Layer-View': {fields: childFieldIds},
    },
    viewsets: {
      'Grid-Square': {views: ['Grid-Square-View']},
      Layer: {views: ['Layer-View']},
    },
  }) as unknown as UiSpecModel;

describe('getParentDependentFieldsForForm', () => {
  it('detects a ParentFieldDisplay field', () => {
    const uiSpecification = makeUiSpec(
      {
        'Square-Ref': {
          'component-name': 'ParentFieldDisplay',
          'component-parameters': {parentFieldId: 'Square-Name'},
        },
      },
      ['Square-Ref']
    );
    const {fields, parentForms} = getParentDependentFieldsForForm({
      uiSpecification,
      formId: 'Layer',
    });
    expect(parentForms).toEqual(['Grid-Square']);
    expect(fields).toEqual([
      {fieldId: 'Square-Ref', kind: 'parent-field-display'},
    ]);
  });

  it('detects a template referencing a parent field', () => {
    const uiSpecification = makeUiSpec(
      {
        'Layer-Name': {
          'component-name': 'TemplatedStringField',
          'component-parameters': {
            template: '{{_PARENT.Square-Name}}-L{{Layer-Number}}',
          },
        },
      },
      ['Layer-Name']
    );
    const {fields} = getParentDependentFieldsForForm({
      uiSpecification,
      formId: 'Layer',
    });
    expect(fields).toEqual([{fieldId: 'Layer-Name', kind: 'template'}]);
  });

  it('tolerates whitespace and unescaped mustache forms', () => {
    for (const template of [
      '{{ _PARENT.Square-Name }}',
      '{{{_PARENT.Square-Name}}}',
      '{{&_PARENT.Square-Name}}',
    ]) {
      const uiSpecification = makeUiSpec(
        {
          'Layer-Name': {
            'component-name': 'TemplatedStringField',
            'component-parameters': {template},
          },
        },
        ['Layer-Name']
      );
      const {fields} = getParentDependentFieldsForForm({
        uiSpecification,
        formId: 'Layer',
      });
      expect(fields).toHaveLength(1);
    }
  });

  it('ignores a template with no parent reference', () => {
    const uiSpecification = makeUiSpec(
      {
        'Layer-Name': {
          'component-name': 'TemplatedStringField',
          'component-parameters': {template: 'L{{Layer-Number}}'},
        },
      },
      ['Layer-Name']
    );
    const {fields} = getParentDependentFieldsForForm({
      uiSpecification,
      formId: 'Layer',
    });
    expect(fields).toEqual([]);
  });

  it('detects a computed field with a parent expression reference', () => {
    const uiSpecification = makeUiSpec(
      {
        'Layer-Area': {
          'component-name': 'ComputedNumber',
          expressionRefs: ['_PARENT.Square-Name', 'Layer-Width'],
        },
      },
      ['Layer-Area']
    );
    const {fields} = getParentDependentFieldsForForm({
      uiSpecification,
      formId: 'Layer',
    });
    expect(fields).toEqual([{fieldId: 'Layer-Area', kind: 'expression'}]);
  });

  it('ignores a computed field with only local references', () => {
    const uiSpecification = makeUiSpec(
      {
        'Layer-Area': {
          'component-name': 'ComputedNumber',
          expressionRefs: ['Layer-Width', 'Layer-Height'],
        },
      },
      ['Layer-Area']
    );
    const {fields} = getParentDependentFieldsForForm({
      uiSpecification,
      formId: 'Layer',
    });
    expect(fields).toEqual([]);
  });

  it('returns nothing for a form with no possible parent form', () => {
    // Grid-Square has parent-shaped fields configured but nothing parents it.
    const uiSpecification = makeUiSpec(
      {
        'Square-Ref': {
          'component-name': 'ParentFieldDisplay',
          'component-parameters': {parentFieldId: 'X'},
        },
      },
      ['Square-Ref']
    );
    const {fields, parentForms} = getParentDependentFieldsForForm({
      uiSpecification,
      formId: 'Grid-Square',
    });
    expect(parentForms).toEqual([]);
    expect(fields).toEqual([]);
  });

  it('reports each dependent field once with its kind', () => {
    const uiSpecification = makeUiSpec(
      {
        'Square-Ref': {
          'component-name': 'ParentFieldDisplay',
          'component-parameters': {parentFieldId: 'Square-Name'},
        },
        'Layer-Name': {
          'component-name': 'TemplatedStringField',
          'component-parameters': {template: '{{_PARENT.Square-Name}}'},
        },
        'Layer-Area': {
          'component-name': 'ComputedNumber',
          expressionRefs: ['_PARENT.Square-Name'],
        },
      },
      ['Square-Ref', 'Layer-Name', 'Layer-Area']
    );
    const {fields} = getParentDependentFieldsForForm({
      uiSpecification,
      formId: 'Layer',
    });
    expect(fields).toHaveLength(3);
    expect(new Set(fields.map(f => f.kind))).toEqual(
      new Set(['parent-field-display', 'template', 'expression'])
    );
  });
});

describe('getParentDependentForms', () => {
  it('maps only dependent forms', () => {
    const uiSpecification = makeUiSpec(
      {
        'Layer-Name': {
          'component-name': 'TemplatedStringField',
          'component-parameters': {template: '{{_PARENT.Square-Name}}'},
        },
      },
      ['Layer-Name']
    );
    const result = getParentDependentForms({uiSpecification});
    expect([...result.keys()]).toEqual(['Layer']);
  });

  it('is empty when no form is parent-dependent', () => {
    const uiSpecification = makeUiSpec(
      {
        'Layer-Notes': {
          'component-name': 'TextField',
          'type-returned': 'faims-core::String',
        },
      },
      ['Layer-Notes']
    );
    expect(getParentDependentForms({uiSpecification}).size).toBe(0);
  });
});
