import {Navigate} from 'react-router-dom';

import {DISABLE_SIGNIN_REDIRECT} from '../buildconfig';
import * as ROUTES from './routes';

interface PrivateRouteProps {
  // tslint:disable-next-line:no-any
  children: React.ReactElement;
  allowed: boolean;
}

export const PrivateRoute = (props: PrivateRouteProps): React.ReactElement => {
  const {children, allowed} = props;
  return allowed || DISABLE_SIGNIN_REDIRECT ? (
    children
  ) : (
    <Navigate to={ROUTES.SIGN_IN} />
  );
};
