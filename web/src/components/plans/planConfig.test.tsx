// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @file Tests for the plan config registry, the built-in config forms and the
 * submission gate: each plan reports a schema-valid config only once its
 * input is complete.
 */

import {COUNTED_PLAN_TYPE, LIST_OF_RECORDS_PLAN_TYPE} from '@faims3/data-model';
import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, test, vi} from 'vitest';
import {countedPlanConfig, countedPlanFields} from './countedPlanFields';
import {ListOfRecordsPlanConfigForm} from './ListOfRecordsPlanConfigForm';
import {PlanConfigSection} from './PlanConfigSection';
import {planSubmissionGate} from './planSubmissionGate';
import {
  createPlanConfigRegistry,
  getPlanConfigType,
  registerPlanConfigType,
  type PlanConfigUiSpec,
} from './registry';

const uiSpec: PlanConfigUiSpec = {
  viewsets: {FORM1: {label: 'Form One', views: ['SECTION1']}},
  views: {SECTION1: {fields: ['Name', 'Count', 'Flag', 'When']}},
  fields: {
    Name: {
      'component-parameters': {label: 'Name'},
      'type-returned': 'faims-core::String',
    },
    Count: {
      'component-parameters': {label: 'Count'},
      'type-returned': 'faims-core::Integer',
    },
    Flag: {
      'component-parameters': {label: 'Flag'},
      'type-returned': 'faims-core::Bool',
    },
    When: {
      'component-parameters': {label: 'When'},
      'type-returned': 'faims-core::Datetime',
    },
  },
};

const countedTemplate = {
  planType: COUNTED_PLAN_TYPE,
  planId: 'counted',
  label: 'Count survey',
  formType: 'FORM1',
};
const listTemplate = {
  planType: LIST_OF_RECORDS_PLAN_TYPE,
  planId: 'list',
  label: 'Site list',
  formType: 'FORM1',
  recordFields: ['Name', 'Count', 'Flag'],
};

const lastCall = (fn: ReturnType<typeof vi.fn>) =>
  fn.mock.calls[fn.mock.calls.length - 1]?.[0];

describe('plan config registry', () => {
  test('resolves the built-in plan types', () => {
    const counted = getPlanConfigType(COUNTED_PLAN_TYPE);
    expect(counted?.label).toBe('Counted');
    expect(counted && 'fields' in counted).toBe(true);
    const list = getPlanConfigType(LIST_OF_RECORDS_PLAN_TYPE);
    expect(list?.label).toBe('List of Records');
    expect(list && 'ConfigForm' in list).toBe(true);
    expect(getPlanConfigType('MapGrid')).toBeUndefined();
  });

  test('rejects duplicate registration', () => {
    const registry = createPlanConfigRegistry();
    const definition = {
      planType: 'Custom',
      label: 'Custom',
      ConfigForm: () => null,
    };
    registerPlanConfigType(definition, registry);
    expect(getPlanConfigType('Custom', registry)).toBe(definition);
    expect(() => registerPlanConfigType(definition, registry)).toThrow(
      /already registered/
    );
  });
});

describe('countedPlanFields', () => {
  const fields = countedPlanFields({
    template: countedTemplate,
    uiSpec,
    prefix: 'plan0_',
  });

  test('prefixes its field names and labels the target form', () => {
    expect(fields.map(f => f.name)).toEqual([
      'plan0_numberRequired',
      'plan0_allowExtraRecords',
    ]);
    expect(fields[0].label).toBe('Number of Form One records required');
  });

  test('accepts only a positive whole number', () => {
    const schema = fields[0].schema;
    expect(schema.safeParse(undefined).success).toBe(false);
    expect(schema.safeParse(0).success).toBe(false);
    expect(schema.safeParse(2.5).success).toBe(false);
    expect(schema.safeParse(5).success).toBe(true);
  });

  test('assembles the config from form values', () => {
    expect(
      countedPlanConfig(
        {plan0_numberRequired: 5, plan0_allowExtraRecords: undefined},
        'plan0_'
      )
    ).toEqual({numberRequired: 5, allowExtraRecords: false});
    expect(
      countedPlanConfig(
        {plan0_numberRequired: 3, plan0_allowExtraRecords: true},
        'plan0_'
      )
    ).toEqual({numberRequired: 3, allowExtraRecords: true});
  });
});

describe('ListOfRecordsPlanConfigForm', () => {
  test('emits records keyed by reference with typed values', () => {
    const onChange = vi.fn();
    render(
      <ListOfRecordsPlanConfigForm
        template={listTemplate}
        uiSpec={uiSpec}
        onChange={onChange}
      />
    );
    expect(lastCall(onChange)).toBeUndefined();

    fireEvent.click(screen.getByTestId('plan-config-add-record'));
    fireEvent.change(screen.getByLabelText('Name for planned-1'), {
      target: {value: 'Alpha'},
    });
    fireEvent.change(screen.getByLabelText('Count for planned-1'), {
      target: {value: '12'},
    });
    fireEvent.click(screen.getByLabelText('Flag for planned-1'));

    expect(lastCall(onChange)).toEqual({
      recordData: {'planned-1': {Name: 'Alpha', Count: 12, Flag: true}},
      allowExtraRecords: false,
    });
  });

  test('never reuses a removed reference', () => {
    const onChange = vi.fn();
    render(
      <ListOfRecordsPlanConfigForm
        template={listTemplate}
        uiSpec={uiSpec}
        onChange={onChange}
      />
    );
    const add = screen.getByTestId('plan-config-add-record');
    fireEvent.click(add);
    fireEvent.click(add);
    fireEvent.click(screen.getByLabelText('Remove planned-1'));
    fireEvent.click(add);

    expect(Object.keys(lastCall(onChange).recordData)).toEqual([
      'planned-2',
      'planned-3',
    ]);
  });

  test('is incomplete again when every row is removed', () => {
    const onChange = vi.fn();
    render(
      <ListOfRecordsPlanConfigForm
        template={listTemplate}
        uiSpec={uiSpec}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByTestId('plan-config-add-record'));
    expect(lastCall(onChange)).toBeDefined();
    fireEvent.click(screen.getByLabelText('Remove planned-1'));
    expect(lastCall(onChange)).toBeUndefined();
  });

  test('skips a field whose type it cannot pre-fill', () => {
    render(
      <ListOfRecordsPlanConfigForm
        template={{...listTemplate, recordFields: ['Name', 'When']}}
        uiSpec={uiSpec}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByText('When')).toBeNull();
    expect(screen.getByText(/entered on each record/).textContent).toContain(
      'When'
    );
  });
});

describe('planSubmissionGate', () => {
  test('allows submit when there are no plan templates', () => {
    expect(planSubmissionGate({})).toBeUndefined();
  });

  test('blocks while the template is loading', () => {
    expect(planSubmissionGate({isLoading: true})?.reason).toMatch(/Loading/);
  });

  test('blocks when the template fetch fails', () => {
    expect(planSubmissionGate({isError: true})?.reason).toMatch(
      /Could not load/
    );
  });

  test('leaves field-based plans to the form', () => {
    expect(
      planSubmissionGate({planTemplates: [countedTemplate]})
    ).toBeUndefined();
  });

  test('blocks a component-based plan until its config is supplied', () => {
    expect(planSubmissionGate({planTemplates: [listTemplate]})?.reason).toMatch(
      /Complete the Site list plan/
    );
    expect(
      planSubmissionGate({
        planTemplates: [listTemplate],
        componentConfigs: {list: {recordData: {}, allowExtraRecords: false}},
      })
    ).toBeUndefined();
  });

  test('blocks unregistered plan types', () => {
    expect(
      planSubmissionGate({
        planTemplates: [{planType: 'MapGrid', planId: 'grid', label: 'Grid'}],
      })?.reason
    ).toMatch(/cannot be configured/);
  });
});

describe('PlanConfigSection', () => {
  test('renders the registered form under the plan label', () => {
    render(
      <PlanConfigSection
        template={listTemplate}
        uiSpec={uiSpec}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('Site list plan')).toBeTruthy();
    expect(screen.getByTestId('plan-config-add-record')).toBeTruthy();
  });

  test('explains when no form is registered for the plan type', () => {
    render(
      <PlanConfigSection
        template={{planType: 'MapGrid', planId: 'grid', label: 'Grid'}}
        uiSpec={uiSpec}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('Unsupported plan type')).toBeTruthy();
  });
});
