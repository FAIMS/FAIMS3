import {useState} from 'react';
import Feature from 'ol/Feature';
import './MapFormField.css';
import MapWrapper from './MapWrapper';
import Button from '@material-ui/core/Button';
import {FieldProps} from 'formik';
import GeoJSON from 'ol/format/GeoJSON';

interface MapFieldProps extends FieldProps {
  featureType: 'Point' | 'Polygon' | 'Circle' | 'LineString';
}

function MapFormField({field, form, ...props}: MapFieldProps) {
  const [showMap, setShowMap] = useState(false);
  const [drawnFeatures, setDrawnFeatures] = useState<Array<Feature<any>>>([]);

  const zoom = 12;
  const center = [16817368.76, -4006732];

  const mapCallback = (theFeatures: any) => {
    setDrawnFeatures(theFeatures);
    setShowMap(false);

    form.setFieldValue(field.name, theFeatures);
  };

  if (showMap) {
    window.scrollTo(0, 0);
    return (
      <div>
        <MapWrapper
          featureType={props.featureType}
          features={drawnFeatures}
          zoom={zoom}
          center={center}
          callbackFn={mapCallback}
        />
      </div>
    );
  } else {
    const gj = new GeoJSON().writeFeaturesObject(drawnFeatures, {
      dataProjection: 'EPSG:3857',
    });

    return (
      <div>
        <Button
          variant="outlined"
          color={'primary'}
          style={{marginRight: '10px'}}
          onClick={() => setShowMap(true)}
        >
          Get Map {props.featureType}
        </Button>
      </div>
    );
  }
}

export default MapFormField;
