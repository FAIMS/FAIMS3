import {Navigate} from 'react-router-dom';

import {DISABLE_SIGNIN_REDIRECT} from '../buildconfig';
import * as ROUTES from './routes';
import {useGetAnyToken} from '../utils/tokenHooks';
import LoadingApp from '../gui/components/loadingApp';

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
  // Get a default token - this is the first listing's token
  // TODO use a context provider for listings instead of getting first entry
  const anyToken = useGetAnyToken();
  // The token is being retrieved
  if (anyToken.isFetching) {
    return <LoadingApp />;
  }

  if (anyToken.data?.token) return props.children;
  else return <Navigate to={ROUTES.SIGN_IN} />;
};
