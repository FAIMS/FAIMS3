/**
 * @file Tests for the map interaction the notebook's maps share: the styling a
 * plotted feature takes, the layer and extent a GeoJSON collection yields, and
 * the tap detection that stands in for click on touch devices.
 */
import type Map from 'ol/Map';
import CircleStyle from 'ol/style/Circle';
import {describe, expect, it, vi} from 'vitest';
import {
  addFeatureLayerToMap,
  featureStyle,
  isOpeningTapBackdropClick,
  listenForMapTaps,
  popoverAnchorForPixel,
  SHORT_WAIT_CONSTANT,
} from './mapFeatureLayer';

/** A map stubbed down to what these helpers ask of it. */
const stubMap = (element: HTMLElement = document.createElement('div')) => {
  const addLayer = vi.fn();
  return {
    element,
    addLayer,
    map: {
      addLayer,
      getView: () => ({getProjection: () => 'EPSG:3857'}),
      getTargetElement: () => element,
      // The pixel the pointer event carries, which the test sets per event
      getEventPixel: (evt: Event) =>
        (evt as unknown as {mapPixel: number[]}).mapPixel,
    } as unknown as Map,
  };
};

/** A pointer event as the map element receives it, carrying its map pixel. */
const pointerEvent = (
  type: 'pointerdown' | 'pointerup',
  {pixel, pointerId = 1}: {pixel: number[]; pointerId?: number}
) => Object.assign(new MouseEvent(type), {pointerId, mapPixel: pixel});

const pointCollection = (coordinates: number[][]) => ({
  type: 'FeatureCollection',
  features: coordinates.map(position => ({
    type: 'Feature',
    geometry: {type: 'Point', coordinates: position},
    properties: {},
  })),
});

describe('featureStyle', () => {
  it('draws a selected feature larger and outlined in white', () => {
    const selected = featureStyle({color: '#112233', selected: true});
    const image = selected.getImage() as CircleStyle;
    expect(image.getRadius()).toBe(10);
    expect(image.getStroke()?.getColor()).toBe('#ffffff');
    expect(selected.getStroke()?.getWidth()).toBe(5);
    // Polygons keep the feature colour, less transparent while selected
    expect(selected.getFill()?.getColor()).toBe('#112233cc');
  });

  it('draws an unselected feature in its own colour', () => {
    const unselected = featureStyle({color: '#112233', selected: false});
    expect((unselected.getImage() as CircleStyle).getRadius()).toBe(7);
    expect(unselected.getStroke()?.getColor()).toBe('#112233');
    expect(unselected.getFill()?.getColor()).toBe('#11223380');
  });
});

describe('addFeatureLayerToMap', () => {
  it('plots the collection and reports its extent in lon/lat', () => {
    const {map, addLayer} = stubMap();
    const style = vi.fn();

    const {layer, extent} = addFeatureLayerToMap({
      map,
      collection: pointCollection([
        [151, -33],
        [152, -34],
      ]),
      style,
    });

    expect(addLayer).toHaveBeenCalledWith(layer);
    expect(layer.getSource()?.getFeatures()).toHaveLength(2);
    expect(layer.getStyle()).toBe(style);
    expect(extent?.map(value => Math.round(value))).toEqual([
      151, -34, 152, -33,
    ]);
  });

  it('still adds a layer, without an extent, when the geometry cannot be read', () => {
    const {map, addLayer} = stubMap();
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const {layer, extent} = addFeatureLayerToMap({
      map,
      collection: {type: 'FeatureCollection'},
      style: vi.fn(),
    });

    expect(addLayer).toHaveBeenCalledWith(layer);
    expect(extent).toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('reports no extent for an empty collection', () => {
    const {map} = stubMap();
    expect(
      addFeatureLayerToMap({
        map,
        collection: pointCollection([]),
        style: vi.fn(),
      }).extent
    ).toBeUndefined();
  });
});

describe('listenForMapTaps', () => {
  it('reports a quick tap at the pixel it ended on', () => {
    const {map, element} = stubMap();
    const onTap = vi.fn();
    listenForMapTaps({map, onTap});

    element.dispatchEvent(pointerEvent('pointerdown', {pixel: [10, 20]}));
    element.dispatchEvent(pointerEvent('pointerup', {pixel: [12, 21]}));

    expect(onTap).toHaveBeenCalledWith([12, 21]);
  });

  it('ignores a pan, which moves too far to be a tap', () => {
    const {map, element} = stubMap();
    const onTap = vi.fn();
    listenForMapTaps({map, onTap});

    element.dispatchEvent(pointerEvent('pointerdown', {pixel: [10, 20]}));
    element.dispatchEvent(pointerEvent('pointerup', {pixel: [90, 20]}));

    expect(onTap).not.toHaveBeenCalled();
  });

  it('ignores a slow press, and a second finger the press did not start with', () => {
    const {map, element} = stubMap();
    const onTap = vi.fn();
    const now = vi.spyOn(Date, 'now');
    listenForMapTaps({map, onTap});

    now.mockReturnValue(1000);
    element.dispatchEvent(pointerEvent('pointerdown', {pixel: [10, 20]}));
    now.mockReturnValue(1000 + SHORT_WAIT_CONSTANT + 1);
    element.dispatchEvent(pointerEvent('pointerup', {pixel: [10, 20]}));
    expect(onTap).not.toHaveBeenCalled();
    now.mockRestore();

    element.dispatchEvent(pointerEvent('pointerdown', {pixel: [10, 20]}));
    element.dispatchEvent(
      pointerEvent('pointerup', {pixel: [10, 20], pointerId: 2})
    );
    expect(onTap).not.toHaveBeenCalled();
  });

  it('stops listening once its cleanup runs', () => {
    const {map, element} = stubMap();
    const onTap = vi.fn();
    listenForMapTaps({map, onTap})();

    element.dispatchEvent(pointerEvent('pointerdown', {pixel: [10, 20]}));
    element.dispatchEvent(pointerEvent('pointerup', {pixel: [10, 20]}));

    expect(onTap).not.toHaveBeenCalled();
  });
});

describe('popoverAnchorForPixel', () => {
  it('anchors to the tap, offset by the map in the viewport', () => {
    const element = document.createElement('div');
    element.getBoundingClientRect = () => ({left: 40, top: 100}) as DOMRect;
    const {map} = stubMap(element);

    expect(popoverAnchorForPixel({map, pixel: [10, 20]})).toEqual({
      left: 50,
      top: 120,
    });
  });
});

describe('isOpeningTapBackdropClick', () => {
  it('ignores the backdrop click of the tap that just opened the popover', () => {
    expect(
      isOpeningTapBackdropClick({
        reason: 'backdropClick',
        openedAt: Date.now(),
      })
    ).toBe(true);
  });

  it('closes on a later backdrop click, and always on escape', () => {
    expect(
      isOpeningTapBackdropClick({
        reason: 'backdropClick',
        openedAt: Date.now() - SHORT_WAIT_CONSTANT - 1,
      })
    ).toBe(false);
    expect(
      isOpeningTapBackdropClick({
        reason: 'escapeKeyDown',
        openedAt: Date.now(),
      })
    ).toBe(false);
  });
});
