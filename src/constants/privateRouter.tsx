import {Route, Redirect, RouteProps} from 'react-router-dom';

import {DISABLE_SIGNIN_REDIRECT} from '../buildconfig';
import * as ROUTES from './routes';
import {useContext} from 'react';
import {store} from '../context/store';

interface PrivateRouteProps extends RouteProps {
  // tslint:disable-next-line:no-any
  component: any;
  extraProps?: any;
  is_sign?: boolean;
}

export const PrivateRoute = (props: PrivateRouteProps) => {
  const {component: Component, is_sign, extraProps, ...rest} = props;
  const {state} = useContext(store);
  return (
    <Route
      {...rest}
      render={routeProps =>
        is_sign === true || DISABLE_SIGNIN_REDIRECT ? (
          <Component {...extraProps} {...routeProps} />
        ) : state.token ? (
          <Component {...extraProps} {...routeProps} />
        ) : (
          <Redirect
            to={{
              pathname: ROUTES.SIGN_IN,
              state: {from: routeProps.location},
            }}
          />
        )
      }
    />
  );
};
