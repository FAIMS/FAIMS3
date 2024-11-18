import Map from 'ol/Map';
import {
  getRecordsWithRegex,
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
  const defaultMapProjection = 'EPSG:3857';
  const geoJson = new GeoJSON();
  const [features, setFeatures] = useState<{type: string; features: any[]}>({
    type: 'FeatureCollection',
    features: [],
  });

  const getGISFields = (uiSpec: ProjectUIModel) => {
    const fields = Object.getOwnPropertyNames(uiSpec.fields);
    return fields.filter(
      (field: string) =>
        uiSpec.fields[field]['component-name'] === 'MapFormField' ||
        uiSpec.fields[field]['component-name'] === 'TakePoint'
    );
  };

  useEffect(() => {
    const init = async () => {
      const gisFields = getGISFields(props.uiSpec);
      console.log('gisFields', gisFields);
      if (gisFields.length > 0) {
        const records = await getRecordsWithRegex(props.project_id, '.*', true);
        const f: any[] = [];
        records.forEach(record => {
          if (record.data) {
            gisFields.forEach((field: string) => {
              // two options here, if it's a TakePoint field we'll have a single feature
              // if it's a MapFormField we'll have an object with multiple features
              if (record.data?.[field] && record.data[field].type) {
                if (record.data[field].type === 'FeatureCollection') {
                  record.data[field].features.forEach((feature: any) => {
                    f.push(feature);
                  });
                } else {
                  f.push(record.data[field]);
                }
              }
            });
          }
        });
        console.log('collected features', f);
        setFeatures({
          type: 'FeatureCollection',
          features: f,
        });
      }
    };

    init().catch(console.error);
  }, []);

  // create state ref that can be accessed in OpenLayers onclick callback function
  //  https://stackoverflow.com/a/60643670
  const mapRef = useRef<Map | undefined>();
  mapRef.current = map;

  const map_center = [30, -10];

  const createMap = useCallback(async (element: HTMLElement): Promise<Map> => {
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
  }, []);

  const addFeaturesToMap = (map: Map) => {
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

    if (features && features.features.length > 0) {
      const parsedFeatures = geoJson.readFeatures(features, {
        dataProjection: 'EPSG:4326',
        featureProjection: map.getView().getProjection(),
      });
      source.addFeatures(parsedFeatures);

      // set the view so that we can see the features
      // but don't zoom too much
      const extent = source.getExtent();
      // don't fit if the extent is infinite because it crashes
      if (!extent.includes(Infinity)) {
        map.getView().fit(extent, {padding: [100, 100, 100, 100], maxZoom: 12});
      }
    }

    map.addLayer(layer);
  };

  const refCallback = (element: HTMLElement | null) => {
    console.log('refCallback', element);
    if (element) {
      if (!map) {
        // create map
        createMap(element, props).then((theMap: Map) => {
          addFeaturesToMap(theMap);
          setMap(theMap);
        });
      } else {
        map.setTarget(element);
        addFeaturesToMap(map);
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
