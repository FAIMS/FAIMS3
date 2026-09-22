/**
 * @file The OpenLayers work the notebook's maps share: plotting a GeoJSON
 * collection as a styled vector layer, reading taps off the map, and the
 * guards a popover opened by a tap needs. The OverviewMap plots saved record
 * geometry and the Map Collection plan's record map plots planned geometry;
 * both sit on @faims3/forms' MapComponent and must behave the same under a
 * finger.
 */
import {Extent} from 'ol/extent';
import GeoJSON from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import {transformExtent} from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import {Fill, Stroke, Style} from 'ol/style';
import CircleStyle from 'ol/style/Circle';
import {StyleFunction} from 'ol/style/Style';

/**
 * Short time which is used for various checks on a map, including guarding the
 * popover button, and for tap detection.
 */
export const SHORT_WAIT_CONSTANT = 400;

/** How far a pointer may travel and still be a tap rather than a pan. */
const TAP_MAX_MOVEMENT_PX = 15;

/** The style for a plotted feature, by its colour and whether it is selected. */
export const featureStyle = ({
  color,
  selected,
}: {
  color: string;
  selected: boolean;
}): Style =>
  selected
    ? new Style({
        stroke: new Stroke({color: '#ffffff', width: 5}),
        fill: new Fill({color: color + 'cc'}),
        image: new CircleStyle({
          radius: 10,
          fill: new Fill({color}),
          stroke: new Stroke({color: '#ffffff', width: 4}),
        }),
      })
    : new Style({
        stroke: new Stroke({color, width: 4}),
        fill: new Fill({color: color + '80'}), // 50% opacity for polygons
        image: new CircleStyle({
          radius: 7,
          fill: new Fill({color}),
          stroke: new Stroke({color: '#fff', width: 2}),
        }),
      });

/**
 * Plot a GeoJSON collection on the map as a new vector layer, and report the
 * extent the view should fit, in lon/lat. The extent is absent when the
 * collection is empty or its geometry cannot be read, in which case the layer
 * is still added so the caller has one layer to remove either way.
 */
export const addFeatureLayerToMap = ({
  map,
  collection,
  style,
}: {
  map: Map;
  /** A GeoJSON FeatureCollection in EPSG:4326, as the map's features are held. */
  collection: object;
  style: StyleFunction;
}): {layer: VectorLayer<VectorSource>; extent: Extent | undefined} => {
  const source = new VectorSource();
  const layer = new VectorLayer({source, style});
  let extent: Extent | undefined;

  try {
    source.addFeatures(
      new GeoJSON().readFeatures(collection, {
        dataProjection: 'EPSG:4326',
        featureProjection: map.getView().getProjection(),
      })
    );
    const sourceExtent = source.getExtent();
    if (sourceExtent && !sourceExtent.some(val => !isFinite(val))) {
      const lonLatExtent = transformExtent(
        sourceExtent,
        map.getView().getProjection(),
        'EPSG:4326'
      );
      if (!lonLatExtent.some(val => !isFinite(val))) extent = lonLatExtent;
    }
  } catch (error) {
    console.error('Failed to parse GeoJSON features:', error);
  }

  map.addLayer(layer);
  return {layer, extent};
};

/**
 * Report quick taps on the map, in map pixels, and return the function that
 * stops listening. Taps are detected on pointerdown/pointerup rather than
 * click because on many Android browsers the map's pan interaction consumes
 * the gesture, so click often does not fire or only fires on long-press. A
 * quick pointerdown→pointerup with little movement is treated as a tap.
 */
export const listenForMapTaps = ({
  map,
  onTap,
}: {
  map: Map;
  onTap: (pixel: number[]) => void;
}): (() => void) => {
  let pointerDown: {pixel: number[]; time: number; id: number} | null = null;

  const handlePointerDown = (evt: PointerEvent) => {
    pointerDown = {
      pixel: map.getEventPixel(evt).slice(),
      time: Date.now(),
      id: evt.pointerId,
    };
  };

  const handlePointerUp = (evt: PointerEvent) => {
    const upPixel = map.getEventPixel(evt);
    if (!pointerDown || pointerDown.id !== evt.pointerId) return;
    const dt = Date.now() - pointerDown.time;
    const dx = Math.abs(upPixel[0] - pointerDown.pixel[0]);
    const dy = Math.abs(upPixel[1] - pointerDown.pixel[1]);
    const withinTime = dt <= SHORT_WAIT_CONSTANT;
    const withinMove = dx <= TAP_MAX_MOVEMENT_PX && dy <= TAP_MAX_MOVEMENT_PX;
    pointerDown = null;
    if (withinTime && withinMove) onTap(upPixel);
  };

  const mapEl = map.getTargetElement();
  mapEl.addEventListener('pointerdown', handlePointerDown);
  mapEl.addEventListener('pointerup', handlePointerUp);
  return () => {
    mapEl.removeEventListener('pointerdown', handlePointerDown);
    mapEl.removeEventListener('pointerup', handlePointerUp);
  };
};

/**
 * Where to anchor a popover for a map pixel, in viewport coordinates. Anchored
 * to the tap rather than to the map container, whose rect can be wrong before
 * layout has settled and so places the first popover badly.
 */
export const popoverAnchorForPixel = ({
  map,
  pixel,
}: {
  map: Map;
  pixel: number[];
}): {left: number; top: number} => {
  const rect = map.getTargetElement().getBoundingClientRect();
  return {left: rect.left + pixel[0], top: rect.top + pixel[1]};
};

/**
 * Whether a popover close should be ignored: on touch the same tap that opens
 * a popover is often reported as a backdrop click on it too, which would close
 * it immediately.
 */
export const isOpeningTapBackdropClick = ({
  reason,
  openedAt,
}: {
  reason: 'backdropClick' | 'escapeKeyDown';
  openedAt: number;
}): boolean =>
  reason === 'backdropClick' && Date.now() - openedAt < SHORT_WAIT_CONSTANT;
