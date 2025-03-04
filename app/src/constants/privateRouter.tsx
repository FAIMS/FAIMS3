import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import {
  Alert,
  AlertTitle,
  Box,
  Link,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {useEffect, useRef, useState} from 'react';
import {Navigate, Link as RouterLink} from 'react-router-dom';
import {useAppSelector} from '../context/store';
import {useIsOnline} from '../utils/customHooks';
import * as ROUTES from './routes';

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

/**
 * Props for the OfflineLoginBanner component
 * @property {string} loginPath - Route path for the login page
 */
interface OfflineLoginBannerProps {
  loginPath: string;
  visible: boolean;
}

/**
 * OfflineLoginBanner Component
 *
 * A responsive banner that displays when users are logged out, warning them
 * that their data won't be synchronized. The banner has two states:
 *
 * Initial state: Part of the normal document flow, and Sticky state: Fixed to
 * the top after scrolling past the navbar (roughly - currently in wrong context
 * to know for sure height of nav bar) - but if you scroll to the top you'll be
 * okay
 *
 * Uses an Intersection Observer to detect scroll position relative to navbar
 */
const OfflineLoginBanner = ({loginPath, visible}: OfflineLoginBannerProps) => {
  const [isSticky, setIsSticky] = useState(false);
  const observerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Set up intersection observer to detect when banner should become sticky
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting);
      },
      {
        threshold: [0, 1], // Observe at both fully visible and fully hidden states
        // Adjust observer margin based on navbar height for different screen sizes
        rootMargin: isMobile ? '-64px 0px 0px 0px' : '-100px 0px 0px 0px',
      }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [isMobile]); // Recreate observer when screen size changes

  return (
    <>
      {/* Invisible element for intersection observer */}
      <Box ref={observerRef} sx={{height: 0, width: '100%'}} />

      <Box
        sx={{
          // Container positioning
          width: '100%',
          position: isSticky ? 'fixed' : 'relative',
          top: isSticky ? 0 : 'auto',
          left: isSticky ? 0 : 'auto',
          right: isSticky ? 0 : 'auto',

          // Ensure banner stays above other content
          zIndex: 1300,

          // Smooth transitions for position changes
          transition: 'all 500ms cubic-bezier(0.4, 0, 0.2, 1)',

          // Visual effects
          boxShadow: isSticky ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',

          // Margin for content spacing below
          marginBottom: 2,

          // Make invisible if not visible
          visibility: visible ? 'visible' : 'hidden',
          opacity: visible ? 1 : 0,
          height: visible ? 'auto' : 0,
          overflow: 'hidden',
        }}
      >
        <Alert
          icon={<ErrorOutlineIcon sx={{fontSize: 28}} />}
          severity="error"
          sx={{
            borderRadius: 2.5,

            // Error theme styling
            backgroundColor: 'error.main',
            color: 'error.contrastText',

            // Responsive padding
            padding: isMobile ? 1.5 : 2,

            // Icon styling
            '& .MuiAlert-icon': {
              color: 'error.contrastText',
              opacity: 0.9,
              marginRight: 2,
              // center the exclamation icon
              display: 'flex',
              alignItems: 'center',
            },

            // Ensure message takes full width
            '& .MuiAlert-message': {
              width: '100%',
            },
          }}
        >
          <Box
            sx={{
              // Flex container for content layout
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              width: '100%',
              gap: isMobile ? 2 : 3,

              // Alignment adjustments
              alignItems: isMobile ? 'stretch' : 'center',
              justifyContent: 'flex-start',
            }}
          >
            {/* Alert message */}
            <AlertTitle
              sx={{
                m: 0,
                fontSize: isMobile ? '0.875rem' : '1rem',
                lineHeight: '1.4',
                color: 'inherit',
                fontWeight: 500,
              }}
            >
              You are currently logged out.
              <br />
              Your data will be saved on your device, but not uploaded.
            </AlertTitle>

            {/* Login button container */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isMobile ? 'flex-start' : 'flex-end',
              }}
            >
              {/* Styled login link/button */}
              <Link
                component={RouterLink}
                to={loginPath}
                sx={{
                  // Base styling
                  color: 'inherit',
                  textDecoration: 'none',
                  fontSize: isMobile ? '0.875rem' : '1rem',
                  fontWeight: 500,

                  // Button-like appearance
                  padding: '6px 16px',
                  border: '1px solid currentColor',
                  borderRadius: 1,

                  // Hover effects
                  transition: 'all 200ms ease-in-out',
                  opacity: 0.9,
                  '&:hover': {
                    opacity: 1,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    textDecoration: 'none',
                  },
                }}
              >
                Click to login
              </Link>
            </Box>
          </Box>
        </Alert>
      </Box>
    </>
  );
};

/**
 * Conditional auth route - this requires that the token is present but allows
 * for the case where the token has expired, but adds a warning!
 *
 * This is very careful to not force a remount/rerender of the main content by
 * keeping the banner there all the time but making it invisible. This is due to
 * the fragility of the main form to re-renders.
 *
 * @param props children to render
 * @returns Conditionally renders children if token is present (not necessarily
 * valid) for the first listing entry in the listings db
 */
export const TolerantPrivateRoute = (
  props: PrivateRouteProps
): React.ReactElement => {
  const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);
  const isToken = useAppSelector(state => !!state.auth.activeUser?.token);
  const {isOnline} = useIsOnline();
  const bannerVisible = !isAuthenticated && isToken && isOnline;

  // Good case - all good
  if (!isAuthenticated && !isToken) {
    return <Navigate to={ROUTES.SIGN_IN} />;
  } else {
    return (
      <>
        <OfflineLoginBanner
          visible={bannerVisible}
          loginPath={ROUTES.SIGN_IN}
        />
        {props.children}
      </>
    );
  }
};

/**
 * This only renders the page if navigator thinks the device is online. Shows
 * fallback component otherwise. Can be stacked with other route wrappers.
 * @param props children to render
 */
export const OnlineOnlyRoute = (
  props: PrivateRouteProps
): React.ReactElement => {
  // Offline/online?
  const {isOnline, fallback} = useIsOnline();

  // online? render the route
  if (isOnline) return props.children;

  // Offline -return the fallback
  return <>{fallback}</>;
};
