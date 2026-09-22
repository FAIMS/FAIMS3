/**
 * @file Tests for the Map Collection plan's record map. The map itself is
 * OpenLayers, so the shared layer and tap helpers stand in for it (they are
 * tested in mapFeatureLayer.test.ts): what is tested here is the styling the
 * map asks for, and what a tap on a planned entry offers.
 */
import '@testing-library/jest-dom';
import {type MapCollectionPlanEntry} from '@faims3/data-model';
import {createTheme} from '@mui/material/styles';
import {act, render, screen, waitFor} from '@testing-library/react';
import type {Style} from 'ol/style';
import CircleStyle from 'ol/style/Circle';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {PlanRecordMap} from './PlanRecordMap';
import type {
  PlanRecordFeatureCollection,
  PlanRecordFeatureProps,
} from './planRecordMapFeatures';

/** The extent the stubbed layer helper reports, in lon/lat. */
const EXTENT = [151, -34, 152, -33];

/**
 * What the stubbed map and helpers hold between the component and the test:
 * the style function the layer was given, the tap handler the map registered,
 * and which feature the next tap lands on.
 */
const harness = vi.hoisted(() => {
  const state: {
    tappedFeature: PlanRecordFeatureProps | undefined;
    style: ((feature: {get: (key: string) => unknown}) => Style) | undefined;
    onTap: ((pixel: number[]) => void) | undefined;
  } = {tappedFeature: undefined, style: undefined, onTap: undefined};

  const map = {
    removeLayer: vi.fn(),
    forEachFeatureAtPixel: (
      _pixel: number[],
      callback: (feature: {
        getProperties: () => PlanRecordFeatureProps;
      }) => unknown
    ) =>
      state.tappedFeature
        ? callback({getProperties: () => state.tappedFeature!})
        : undefined,
  };

  return {state, map, stopListening: vi.fn()};
});

// The map component hands its map over as soon as it is mounted
vi.mock('@faims3/forms', async () => {
  const {useEffect} = await import('react');
  return {
    MapComponent: ({
      parentSetMap,
      extent,
    }: {
      parentSetMap: (map: unknown) => void;
      extent?: number[];
    }) => {
      useEffect(() => {
        parentSetMap(harness.map);
      }, []);
      return (
        <div data-testid="map-component" data-extent={JSON.stringify(extent)} />
      );
    },
  };
});

// OpenLayers plots nothing in jsdom, so the layer and tap helpers are captured
vi.mock('../mapFeatureLayer', async importOriginal => {
  const actual = await importOriginal<typeof import('../mapFeatureLayer')>();
  return {
    ...actual,
    addFeatureLayerToMap: ({
      style,
    }: {
      style: (feature: {get: (key: string) => unknown}) => Style;
    }) => {
      harness.state.style = style;
      return {layer: {changed: vi.fn()}, extent: EXTENT};
    },
    listenForMapTaps: ({onTap}: {onTap: (pixel: number[]) => void}) => {
      harness.state.onTap = onTap;
      return harness.stopListening;
    },
    popoverAnchorForPixel: () => ({left: 50, top: 120}),
  };
});

const theme = createTheme();

const entries: Record<string, MapCollectionPlanEntry> = {
  'planned-1': {
    fields: {Name: 'Site 1'},
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
};

const features: PlanRecordFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {type: 'Point', coordinates: [151, -33]},
      properties: {
        reference: 'planned-1',
        planReference: 'sites/planned-1',
        created: false,
      },
    },
  ],
};

/** A plotted feature as the layer's style function reads one. */
const plottedFeature = (props: Partial<PlanRecordFeatureProps>) => ({
  get: (key: string) => (props as Record<string, unknown>)[key],
});

/** The circle a point feature is drawn as, which carries its colour and size. */
const circleOf = (style: Style) => style.getImage() as CircleStyle;

const renderMap = ({
  collection = features,
  canCreateRecord = true,
}: {
  collection?: PlanRecordFeatureCollection;
  canCreateRecord?: boolean;
} = {}) => {
  const onCreate = vi.fn();
  const onOpen = vi.fn();
  render(
    <PlanRecordMap
      features={collection}
      entries={entries}
      recordLabel="Site"
      canCreateRecord={canCreateRecord}
      onCreate={onCreate}
      onOpen={onOpen}
    />
  );
  return {onCreate, onOpen};
};

/** Tap the map on a planned entry, as the shared tap helper would report it. */
const tapFeature = (tapped: PlanRecordFeatureProps) => {
  harness.state.tappedFeature = tapped;
  act(() => harness.state.onTap!([10, 20]));
};

describe('PlanRecordMap', () => {
  beforeEach(() => {
    harness.state.tappedFeature = undefined;
    harness.state.style = undefined;
    harness.state.onTap = undefined;
    vi.clearAllMocks();
  });

  it('says so when the plan has nothing to map', () => {
    renderMap({collection: {type: 'FeatureCollection', features: []}});
    expect(screen.getByRole('alert')).toHaveTextContent(
      'no planned records to map'
    );
    expect(screen.queryByTestId('plan-record-map')).toBeNull();
  });

  it('fits the map to the planned geometry, and keys its colours', () => {
    renderMap();
    expect(screen.getByTestId('map-component')).toHaveAttribute(
      'data-extent',
      JSON.stringify(EXTENT)
    );
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Not yet created')).toBeInTheDocument();
  });

  it('plots a created entry and a pending one in different colours', () => {
    renderMap();
    const style = harness.state.style!;

    expect(
      circleOf(style(plottedFeature({reference: 'planned-1', created: true})))
        .getFill()
        ?.getColor()
    ).toBe(theme.palette.success.main);
    expect(
      circleOf(style(plottedFeature({reference: 'planned-1', created: false})))
        .getFill()
        ?.getColor()
    ).toBe(theme.palette.warning.main);
  });

  it('highlights only the entry that was tapped', () => {
    renderMap();
    tapFeature({
      reference: 'planned-1',
      planReference: 'sites/planned-1',
      created: false,
    });
    const style = harness.state.style!;

    expect(
      circleOf(style(plottedFeature({reference: 'planned-1'}))).getRadius()
    ).toBe(10);
    expect(
      circleOf(style(plottedFeature({reference: 'planned-2'}))).getRadius()
    ).toBe(7);
  });

  it('opens the record of a tapped created entry, once the opening tap has passed', async () => {
    const {onOpen} = renderMap();
    tapFeature({
      reference: 'planned-1',
      planReference: 'sites/planned-1',
      created: true,
    });

    expect(screen.getByText('Site: planned-1')).toBeInTheDocument();
    expect(screen.getByText('Site 1')).toBeInTheDocument();
    expect(screen.getByText('Record created')).toBeInTheDocument();

    // The tap that opened the popover must not also press its button
    const view = screen.getByRole('button', {name: 'View record'});
    expect(view).toBeDisabled();
    await waitFor(() => expect(view).toBeEnabled());

    view.click();
    expect(onOpen).toHaveBeenCalledWith('sites/planned-1');
  });

  it('creates the record of a tapped pending entry', async () => {
    const {onCreate} = renderMap();
    tapFeature({
      reference: 'planned-1',
      planReference: 'sites/planned-1',
      created: false,
    });

    expect(screen.getByText('Site: planned-1')).toBeInTheDocument();
    const create = screen.getByRole('button', {name: 'Create record'});
    await waitFor(() => expect(create).toBeEnabled());

    create.click();
    expect(onCreate).toHaveBeenCalledWith('planned-1');
  });

  it('offers no way to create a record when the user may not add one', () => {
    renderMap({canCreateRecord: false});
    tapFeature({
      reference: 'planned-1',
      planReference: 'sites/planned-1',
      created: false,
    });

    expect(screen.getByText('Site: planned-1')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Create record'})).toBeNull();
  });

  it('ignores a tap that lands on no planned geometry', () => {
    renderMap();
    act(() => harness.state.onTap!([10, 20]));
    expect(screen.queryByText('Site: planned-1')).toBeNull();
  });
});
