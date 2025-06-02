import {useLocation} from 'react-router-dom';
import {LocationState} from '../gui/components/record/relationships/RelatedInformation';

export const useParentLink = (): LocationState | null => {
  const location = useLocation();

  if (location?.state && (location.state as LocationState)?.parent_link) {
    return location.state as LocationState;
  }

  return null;
};
