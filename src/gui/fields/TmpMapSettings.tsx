import {getDefaultuiSetting} from './BasicFieldSettings';
import {ProjectUIModel} from '../../datamodel/ui';

const uiSpec = {
  'component-namespace': 'mapping-plugin',
  'component-name': 'MapFormField',
  'type-returned': 'faims-core::JSON',
  'component-parameters': {
    name: 'map-field',
    id: 'map-field',
  },
  validationSchema: [['yup.object']],
  initialValue: {},
};

const uiSetting = () => {
  const newuiSetting: ProjectUIModel = getDefaultuiSetting();
  newuiSetting['viewsets'] = {
    settings: {
      views: [],
      label: 'settings',
    },
  };

  return newuiSetting;
};

export const MapFieldBuilderSettings = [uiSetting(), uiSpec];
