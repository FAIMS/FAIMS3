// Copyright 2026 FAIMS Project
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
 * @file Tests for the plan config registry and the built-in config forms:
 * each form emits a schema-valid config only once its input is complete.
 */

import {COUNTED_PLAN_TYPE, LIST_OF_RECORDS_PLAN_TYPE} from '@faims3/data-model';
import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, test, vi} from 'vitest';
import {CountedPlanConfigForm} from './CountedPlanConfigForm';
import {ListOfRecordsPlanConfigForm} from './ListOfRecordsPlanConfigForm';
import {PlanConfigSection} from './PlanConfigSection';
import {
  createPlanConfigRegistry,
  getPlanConfigType,
  registerPlanConfigType,
  type PlanConfigUiSpec,
} from './registry';

const uiSpec: PlanConfigUiSpec = {
  viewsets: {FORM1: {label: 'Form One', views: ['SECTION1']}},
  views: {SECTION1: {fields: ['Name', 'Count', 'Flag']}},
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
  },
};

const countedTemplate = {planType: COUNTED_PLAN_TYPE, formType: 'FORM1'};
const listTemplate = {
  planType: LIST_OF_RECORDS_PLAN_TYPE,
  formType: 'FORM1',
  recordFields: ['Name', 'Count', 'Flag'],
};

const lastCall = (fn: ReturnType<typeof vi.fn>) =>
  fn.mock.calls[fn.mock.calls.length - 1]?.[0];

describe('plan config registry', () => {
  test('resolves the built-in plan types', () => {
    expect(getPlanConfigType(COUNTED_PLAN_TYPE)?.label).toBe('Counted');
    expect(getPlanConfigType(LIST_OF_RECORDS_PLAN_TYPE)?.label).toBe(
      'List of Records'
    );
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

describe('CountedPlanConfigForm', () => {
  test('emits a config only for a positive whole number', () => {
    const onChange = vi.fn();
    render(
      <CountedPlanConfigForm
        template={countedTemplate}
        uiSpec={uiSpec}
        onChange={onChange}
      />
    );
    expect(lastCall(onChange)).toBeUndefined();

    const input = screen.getByLabelText('Number of Form One records required');
    fireEvent.change(input, {target: {value: '0'}});
    expect(lastCall(onChange)).toBeUndefined();

    fireEvent.change(input, {target: {value: '5'}});
    expect(lastCall(onChange)).toEqual({
      numberRequired: 5,
      allowExtraRecords: false,
    });

    fireEvent.click(screen.getByTestId('plan-config-allow-extra'));
    expect(lastCall(onChange)).toEqual({
      numberRequired: 5,
      allowExtraRecords: true,
    });
  });

  test('shows an error once the field is left invalid', () => {
    render(
      <CountedPlanConfigForm
        template={countedTemplate}
        uiSpec={uiSpec}
        onChange={vi.fn()}
      />
    );
    const input = screen.getByLabelText('Number of Form One records required');
    fireEvent.change(input, {target: {value: '2.5'}});
    fireEvent.blur(input);
    expect(
      screen.getByText('Enter a whole number greater than zero.')
    ).toBeTruthy();
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
});

describe('PlanConfigSection', () => {
  test('renders the registered form for a known plan type', () => {
    render(
      <PlanConfigSection
        template={countedTemplate}
        uiSpec={uiSpec}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('Counted plan')).toBeTruthy();
    expect(screen.getByTestId('plan-config-number-required')).toBeTruthy();
  });

  test('explains when no form is registered for the plan type', () => {
    render(
      <PlanConfigSection
        template={{planType: 'MapGrid', formType: 'FORM1'}}
        uiSpec={uiSpec}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('Unsupported plan type')).toBeTruthy();
  });
});
