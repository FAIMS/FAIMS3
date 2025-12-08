import {DataViewFieldRenderProps} from '../types';

/**
 * The default fallback renderer. Just JSON stringifies the data.
 */
export const DefaultRenderer = (props: DataViewFieldRenderProps) => {
  // Try and json stringify the value for display
  let val = 'Cannot display value';
  try {
    val = JSON.stringify(props.value);
  } catch (e) {
    console.error('Error stringifying value for DefaultRenderer', e);
  }
  return <div>{val}</div>;
};
