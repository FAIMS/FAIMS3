import {DataViewFieldRenderProps} from '../types';
import {logError} from '../../logging';

/**
 * The default fallback renderer. Just JSON stringifies the data.
 */
export const DefaultRenderer = (props: DataViewFieldRenderProps) => {
  // Try and json stringify the value for display
  let val = 'Cannot display value';
  try {
    val = JSON.stringify(props.value);
  } catch (e) {
    logError(new Error('Error stringifying value for DefaultRenderer'), {
      error: e,
    });
  }
  return <div>{val}</div>;
};
