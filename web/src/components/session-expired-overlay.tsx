import {SIGNIN_PATH} from '@/constants';
import {Loader2} from 'lucide-react';
import {useEffect} from 'react';

/**
 * SessionExpiredOverlay component displays a loading state for 2 seconds then
 * redirects to sign in - just gives the app time to settle in case of some
 * loading back and forth
 */
export const SessionExpiredOverlay = () => {
  const handleLogin = () => {
    window.location.href = SIGNIN_PATH;
  };

  useEffect(() => {
    // Show loading state for 2 seconds before displaying the session expired message
    const timer = setTimeout(() => {
      handleLogin();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg font-medium">Checking authentication status...</p>
      </div>
    </div>
  );
};
