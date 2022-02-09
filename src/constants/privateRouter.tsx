import {Route, Redirect, RouteProps} from 'react-router-dom';

import * as ROUTES from './routes';

import {TokenContents} from '../datamodel/core';
interface PrivateRouteProps extends RouteProps {
  // tslint:disable-next-line:no-any
  component: any;
  token?: undefined | TokenContents;
  extraProps?: any;
  is_sign?: boolean;
}

export const PrivateRoute = (props: PrivateRouteProps) => {
  const {component: Component, is_sign, token, extraProps, ...rest} = props;
  return (
    <Route
      {...rest}
      render={routeProps =>
        is_sign === true ? (
          <Component {...extraProps} {...routeProps} />
        ) : token !== undefined ? (
          <Component {...extraProps} {...routeProps} />
        ) : (
          <Redirect
            to={{
              pathname: ROUTES.SIGN_IN,
              state: {from: routeProps.location},
            }}
          />
          // <Component {...routeProps} />
        )
      }
    />
  );
};
