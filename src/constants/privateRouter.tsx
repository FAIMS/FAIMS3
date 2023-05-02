import {Route, Navigate, RouteProps} from 'react-router-dom';

import {DISABLE_SIGNIN_REDIRECT} from '../buildconfig';
import * as ROUTES from './routes';
import {TokenContents} from 'faims3-datamodel';

interface PrivateRouteProps {
  // tslint:disable-next-line:no-any
  component: any;
  token?: undefined | TokenContents;
  extraProps?: any;
  is_sign?: boolean;
  exact?: boolean;
  path?: string;
}

export const PrivateRoute = (props: PrivateRouteProps) => {
  const {component: Component, is_sign, token, extraProps, ...rest} = props;
  return (
    <Route
      {...rest}
      Component={(routeProps: any) =>
        is_sign === true || DISABLE_SIGNIN_REDIRECT ? (
          <Component {...extraProps} {...routeProps} />
        ) : token !== undefined ? (
          <Component {...extraProps} {...routeProps} />
        ) : (
          <Navigate to={ROUTES.SIGN_IN} state={{from: routeProps.location}} />
        )
      }
    />
  );
};
