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

import {
  COUNTED_PLAN_TYPE,
  LIST_OF_RECORDS_PLAN_TYPE,
  LIST_OF_FORMS_PLAN_TYPE,
  MAP_COLLECTION_PLAN_TYPE,
} from '@faims3/data-model';
import {
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import {describe, expect, test, vi} from 'vitest';
import {countedPlanConfig, countedPlanFields} from './countedPlanFields';
import {ListOfRecordsPlanConfigForm} from './ListOfRecordsPlanConfigForm';
import {MapCollectionPlanConfigForm} from './MapCollectionPlanConfigForm';
import {PlanConfigSection} from './PlanConfigSection';
import {planSubmissionGate} from './planSubmissionGate';
import {usePlanConfigs} from './usePlanConfigs';
import {
  createPlanConfigRegistry,
  getPlanConfigType,
  registerPlanConfigType,
  type PlanConfigUiSpec,
} from './registry';

const uiSpec: PlanConfigUiSpec = {
  viewsets: {FORM1: {label: 'Form One', views: ['SECTION1']}},
  views: {SECTION1: {fields: ['Name', 'Count', 'Flag', 'When', 'Where']}},
  fields: {
    Where: {
      'component-name': 'MapFormField',
      'component-parameters': {label: 'Where', featureType: 'Point'},
      'type-returned': 'faims-core::JSON',
    },
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

const formsTemplate = {
  planType: LIST_OF_FORMS_PLAN_TYPE,
  planId: 'forms',
  label: 'Equipment',
  formTypes: ['FORM1'],
};

const mapTemplate = {
  planType: MAP_COLLECTION_PLAN_TYPE,
  planId: 'map',
  label: 'Site map',
  formType: 'FORM1',
  recordFields: [
    {fieldId: 'Name', required: true},
    {fieldId: 'Count', required: false},
  ],
  spatialFieldId: 'Where',
};

/** A GeoJSON file as the file input would hand it over. */
const geoJsonFile = (features: unknown[]) =>
  new File(
    [JSON.stringify({type: 'FeatureCollection', features})],
    'sites.geojson',
    {type: 'application/geo+json'}
  );

const pointFeature = (
  coordinates: number[],
  properties: Record<string, unknown>
) => ({
  type: 'Feature',
  geometry: {type: 'Point', coordinates},
  properties,
});

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
    const forms = getPlanConfigType(LIST_OF_FORMS_PLAN_TYPE);
    expect(forms?.label).toBe('List of Forms');
    expect(forms && 'fields' in forms).toBe(true);
    const map = getPlanConfigType(MAP_COLLECTION_PLAN_TYPE);
    expect(map?.label).toBe('Map Collection');
    expect(map && 'ConfigForm' in map).toBe(true);
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

describe('MapCollectionPlanConfigForm', () => {
  const renderForm = () => {
    const onChange = vi.fn();
    render(
      <MapCollectionPlanConfigForm
        template={mapTemplate}
        uiSpec={uiSpec}
        onChange={onChange}
      />
    );
    return {onChange, input: screen.getByTestId('plan-config-spatial-file')};
  };

  test('reads a GeoJSON file into one planned record per feature', async () => {
    const {onChange, input} = renderForm();
    expect(lastCall(onChange)).toBeUndefined();

    fireEvent.change(input, {
      target: {
        files: [
          geoJsonFile([
            pointFeature([151, -33], {Name: 'Alpha', Count: '2', Extra: 1}),
            pointFeature([152, -34], {Name: 'Beta'}),
          ]),
        ],
      },
    });

    await waitFor(() => expect(lastCall(onChange)).toBeDefined());
    expect(lastCall(onChange)).toEqual({
      recordData: {
        'planned-1': {
          fields: {Name: 'Alpha', Count: 2},
          spatial: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: {type: 'Point', coordinates: [151, -33]},
                properties: null,
              },
            ],
          },
        },
        'planned-2': {
          fields: {Name: 'Beta'},
          spatial: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: {type: 'Point', coordinates: [152, -34]},
                properties: null,
              },
            ],
          },
        },
      },
      allowExtraRecords: false,
    });
    expect(
      screen.getByTestId('plan-config-spatial-summary').textContent
    ).toMatch(/2 planned Form One records/);
    // The preview's last column summarises each entry's geometry
    expect(
      screen
        .getAllByRole('row')
        .slice(1)
        .map(row => row.lastElementChild?.textContent)
    ).toEqual(['Point', 'Point']);

    fireEvent.click(screen.getByTestId('plan-config-allow-extra'));
    expect(lastCall(onChange).allowExtraRecords).toBe(true);
  });

  test('stays incomplete and lists the problems when a feature is unusable', async () => {
    const {onChange, input} = renderForm();

    fireEvent.change(input, {
      target: {
        files: [
          geoJsonFile([
            pointFeature([151, -33], {Count: 1}), // no Name
            {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [
                  [0, 0],
                  [1, 1],
                ],
              },
              properties: {Name: 'Line'},
            },
          ]),
        ],
      },
    });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Feature 1: Missing required field Name/);
    expect(alert.textContent).toMatch(/Feature 2: .*takes a Point/);
    expect(lastCall(onChange)).toBeUndefined();
  });

  test('rejects an empty collection and a file that is not JSON', async () => {
    const {onChange, input} = renderForm();

    fireEvent.change(input, {target: {files: [geoJsonFile([])]}});
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /no features/
    );
    expect(lastCall(onChange)).toBeUndefined();

    fireEvent.change(input, {
      target: {files: [new File(['not json'], 'bad.geojson')]},
    });
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/not valid JSON/)
    );
    expect(lastCall(onChange)).toBeUndefined();
  });

  test('reads a KML file once the format is switched', async () => {
    const {onChange, input} = renderForm();
    fireEvent.change(screen.getByTestId('plan-config-spatial-format'), {
      target: {value: 'kml'},
    });
    expect(input.getAttribute('accept')).toContain('.kml');

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <Placemark>
    <name>Alpha</name>
    <ExtendedData>
      <Data name="Name"><value>Alpha</value></Data>
      <Data name="Count"><value>2</value></Data>
    </ExtendedData>
    <Point><coordinates>151,-33</coordinates></Point>
  </Placemark>
</Document></kml>`;
    fireEvent.change(input, {
      target: {
        files: [
          new File([kml], 'sites.kml', {
            type: 'application/vnd.google-earth.kml+xml',
          }),
        ],
      },
    });

    await waitFor(() => expect(lastCall(onChange)).toBeDefined());
    expect(lastCall(onChange).recordData).toEqual({
      'planned-1': {
        fields: {Name: 'Alpha', Count: 2},
        spatial: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {type: 'Point', coordinates: [151, -33]},
              properties: null,
            },
          ],
        },
      },
    });

    fireEvent.change(input, {
      target: {files: [new File(['<kml><Placemark>'], 'bad.kml')]},
    });
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(
        /not well-formed XML/
      )
    );
    expect(lastCall(onChange)).toBeUndefined();
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

describe('usePlanConfigs', () => {
  test('heads a plan with nothing to configure, and still sends its config', () => {
    const {result} = renderHook(() =>
      usePlanConfigs({planTemplates: [formsTemplate], uiSpec})
    );

    // A heading past the last field, which Form renders after them
    const {fields, dividers} = result.current.appendTo({fields: []});
    expect(fields).toEqual([]);
    expect(dividers.map(d => d.index)).toEqual([0]);
    render(<>{dividers[0].component}</>);
    expect(screen.getByText('Equipment plan')).toBeTruthy();
    expect(screen.getByText('This plan needs no configuration.')).toBeTruthy();

    expect(result.current.gate).toBeUndefined();
    expect(result.current.toPlanConfigs({})).toEqual({forms: {}});
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
