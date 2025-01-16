import {Link as RouterLink, Navigate} from 'react-router-dom';
import {useAppDispatch, useAppSelector} from '../context/store';
import * as ROUTES from './routes';
import {Alert, Link, AlertTitle, Button} from '@mui/material';
import {useIsOnline} from '../utils/customHooks';
import {dismissLoginBanner} from '../context/slices/authSlice';

interface PrivateRouteProps {
  // tslint:disable-next-line:no-any
  children: React.ReactElement;
}

/**
 * Conditional auth route - this requires that the token is present AND VALID
 *
 * This should be used for routes in the app which will redirect to login even
 * in the situation where there is an expired token for a valid logged in user -
 * this could happen in offline situations.
 *
 * @param props children to render
 * @returns Conditionally renders children if token is present (not necessarily
 * valid) for the first listing entry in the listings db
 */
export const ActivePrivateRoute = (
  props: PrivateRouteProps
): React.ReactElement => {
  // Check if the current active user is nicely logged in (i.e. valid, unexpired
  // token)

  // TODO This will force a re-render if the user is ever logged out - could
  // cause issues in offline context? Or during data collection.
  const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);

  if (isAuthenticated) return props.children;
  else return <Navigate to={ROUTES.SIGN_IN} />;
};

interface OfflineLoginBannerComponentProps {}
const OfflineLoginBannerComponent = (
  props: OfflineLoginBannerComponentProps
) => {
  /**
    Component: OfflineLoginBannerComponent

    This banner is to be shown fixed at the top of the screen to notify the user
    that they are offline and to log back in when the network becomes available.
    */
  const dismissed = useAppSelector(state => state.auth.dismissedLoginBanner);
  const dispatch = useAppDispatch();

  // Offline/online?
  const {isOnline} = useIsOnline();

  return dismissed ? null : (
    <Alert
      severity="warning"
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        borderRadius: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        '& .MuiAlert-message': {
          display: 'flex',
          width: '100%',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
      }}
    >
      <AlertTitle sx={{m: 0}}>You are currently logged out.</AlertTitle>
      {isOnline ? (
        <Link
          component={RouterLink}
          to={ROUTES.SIGN_IN}
          sx={{
            textDecoration: 'none',
            '&:hover': {
              textDecoration: 'underline',
            },
          }}
        >
          Click to login
        </Link>
      ) : (
        <p>
          Your device is <b>offline</b>. Please wait for network connection to
          login.
        </p>
      )}
      {
        // Button to dismiss the banner
      }
      <Button onClick={() => dispatch(dismissLoginBanner())}>Dismiss</Button>
    </Alert>
  );
};

/**
 * Conditional auth route - this requires that the token is present but allows
 * for the case where the token has expired, but adds a warning!
 * @param props children to render
 * @returns Conditionally renders children if token is present (not necessarily
 * valid) for the first listing entry in the listings db
 */
export const OfflinePrivateRoute = (
  props: PrivateRouteProps
): React.ReactElement => {
  // Check if the current active user is nicely logged in (i.e. valid, unexpired
  // token)

  // TODO This will force a re-render if the user is ever logged out - could
  // cause issues in offline context? Or during data collection.
  const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);
  const isToken = useAppSelector(state => !!state.auth.activeUser?.token);

  // Good case - all good
  if (isAuthenticated) return props.children;

  // Token is expired or something else wrong- soft warning
  if (isToken) {
    return (
      <>
        <OfflineLoginBannerComponent />
        {props.children}
      </>
    );
  }
  // User is not logged in and appears to never have been - redirect to login
  else {
    return <Navigate to={ROUTES.SIGN_IN} />;
  }
};
