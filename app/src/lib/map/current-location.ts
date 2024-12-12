import GeoJSON from 'ol/format/GeoJSON';
import VectorSource from 'ol/source/Vector';
import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import {Fill, Style} from 'ol/style';
import CircleStyle from 'ol/style/Circle';
import {useQuery} from '@tanstack/react-query';
import {Geolocation} from '@capacitor/geolocation';

export const getCurrentLocation = () =>
  useQuery({
    queryKey: ['current_location'],
    queryFn: async (): Promise<[number, number]> => {
      const {
        coords: {longitude, latitude},
      } = await Geolocation.getCurrentPosition();
      return [longitude, latitude];
    },
  });

export const addCurrentLocationMarker = (
  map: Map,
  coordinates: [number, number]
) => {
  const source = new VectorSource();

  source.addFeature(
    new GeoJSON().readFeature(
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates,
        },
      },
      {
        dataProjection: 'EPSG:4326',
        featureProjection: map.getView().getProjection(),
      }
    )
  );

  for (const {radius, color} of [
    {radius: 14, color: 'rgba(59, 130, 246, 0.1)'},
    {radius: 8, color: 'rgb(255, 255, 255)'},
    {radius: 6, color: 'rgb(59, 130, 246)'},
  ]) {
    map.addLayer(
      new VectorLayer({
        source: source,
        style: new Style({
          image: new CircleStyle({
            radius,
            fill: new Fill({color}),
          }),
        }),
      })
    );
  }
};
