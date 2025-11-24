import {useStore} from '@tanstack/react-form';
import {FaimsForm} from '../types';

/**
 * Debug component that displays the current form values in JSON format.
 * Useful for development and testing to see form state in real-time.
 */
export const FormStateDisplay = ({form}: {form: FaimsForm}) => {
  const values = useStore(form.store, state => state.values);

  return (
    <div>
      <h3>Current Form Values:</h3>
      <pre>{JSON.stringify(values, null, 2)}</pre>
    </div>
  );
};
