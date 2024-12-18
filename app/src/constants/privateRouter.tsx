import {Navigate} from 'react-router-dom';

import * as ROUTES from './routes';
import {useAppSelector} from '../context/store';

interface PrivateRouteProps {
  // tslint:disable-next-line:no-any
  children: React.ReactElement;
}

/**
 * Conditional auth route
 * @param props children to render
 * @returns Conditionally renders children if token is present (not necessarily
 * valid) for the first listing entry in the listings db
 */
export const PrivateRoute = (props: PrivateRouteProps): React.ReactElement => {
  // Check if the current active user is nicely logged in (i.e. valid, unexpired
  // token)

  // TODO This will force a re-render if the user is ever logged out - could
  // cause issues in offline context? Or during data collection.
  const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);

  if (isAuthenticated) return props.children;
  else return <Navigate to={ROUTES.SIGN_IN} />;
};
