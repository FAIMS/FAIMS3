import Map from 'ol/Map';
import {
  getRecordsWithRegex,
  hydrateRecord,
  ProjectID,
  ProjectUIModel,
} from '@faims3/data-model';
import {Box} from '@mui/material';
import {Feature, View} from 'ol';
import GeoJSON from 'ol/format/GeoJSON';
import {Geometry} from 'ol/geom';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import {OSM} from 'ol/source';
import VectorSource from 'ol/source/Vector';
import {Style, Stroke, Fill} from 'ol/style';
import CircleStyle from 'ol/style/Circle';
import {useState, useRef, useCallback, useEffect} from 'react';
import {createCenterControl} from '../map/center-control';
import {transform} from 'ol/proj';
import {Zoom} from 'ol/control';

interface OverviewMapProps {
  uiSpec: ProjectUIModel;
  project_id: ProjectID;
}

export const OverviewMap = (props: OverviewMapProps) => {
  const [map, setMap] = useState<Map | undefined>();
  const [featuresLayer, setFeaturesLayer] =
    useState<VectorLayer<Feature<Geometry>>>();
  const defaultMapProjection = 'EPSG:3857';
  const geoJson = new GeoJSON();

  console.log('is it a function:', hydrateRecord);
  useEffect(() => {
    console.log(props.project_id, Object.getOwnPropertyNames(props.uiSpec.views)[0]);
    const init = async () => {
      console.log('doing init');
      const records = await getRecordsWithRegex(props.project_id, '.*', true);
      for (const record in records) {
        const full_record = await hydrateRecord(props.project_id, record);
        console.log(full_record);
      }
    };
    init().catch(console.error);
  }, []);

  // create state ref that can be accessed in OpenLayers onclick callback function
  //  https://stackoverflow.com/a/60643670
  const mapRef = useRef<Map | undefined>();
  mapRef.current = map;

  const map_center = [30, -10];

  const createMap = useCallback(
    async (element: HTMLElement, props: OverviewMapProps): Promise<Map> => {
      const center = transform(map_center, 'EPSG:4326', defaultMapProjection);

      const tileLayer = new TileLayer({source: new OSM()});
      const view = new View({
        projection: defaultMapProjection,
        center: center,
        zoom: 12,
      });

      const theMap = new Map({
        target: element,
        layers: [tileLayer],
        view: view,
        controls: [new Zoom()],
      });

      theMap.addControl(createCenterControl(theMap.getView(), center));

      theMap.getView().setCenter(center);

      return theMap;
    },
    []
  );

  const addDrawInteraction = useCallback(
    (map: Map, props: OverviewMapProps) => {
      const source = new VectorSource();

      const layer = new VectorLayer({
        source: source,
        style: new Style({
          stroke: new Stroke({
            color: '#33ff33',
            width: 4,
          }),
          image: new CircleStyle({
            radius: 7,
            fill: new Fill({color: '#33ff33'}),
          }),
        }),
      });

      //   // add features to map if we're passed any in
      //   if (props.features && props.features.type) {
      //     const parsedFeatures = geoJson.readFeatures(props.features, {
      //       dataProjection: 'EPSG:4326',
      //       featureProjection: map.getView().getProjection(),
      //     });
      //     source.addFeatures(parsedFeatures);

      //     // set the view so that we can see the features
      //     // but don't zoom too much
      //     const extent = source.getExtent();
      //     // don't fit if the extent is infinite because it crashes
      //     if (!extent.includes(Infinity)) {
      //       map
      //         .getView()
      //         .fit(extent, {padding: [20, 20, 20, 20], maxZoom: props.zoom});
      //     }
      //   }

      // setDrawInteraction(draw)

      map.addLayer(layer);
      setFeaturesLayer(layer);
    },
    [setFeaturesLayer]
  );

  const refCallback = (element: HTMLElement | null) => {
    if (element) {
      if (!map) {
        // create map
        createMap(element, props).then((theMap: Map) => {
          addDrawInteraction(theMap, props);
          setMap(theMap);
        });
      } else {
        map.setTarget(element);
      }
    }
  };

  // render component
  return (
    <Box
      ref={refCallback}
      sx={{
        height: 600,
        width: '100%',
      }}
    />
  );
};
