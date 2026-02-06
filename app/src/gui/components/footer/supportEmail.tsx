import {Typography} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import Obfuscate from 'react-obfuscate';
import {
  APP_NAME,
  APP_VERSION,
  COMMIT_HASH,
  CONDUCTOR_URLS,
  SUPPORT_EMAIL,
} from '../../../buildconfig';
import {selectActiveUser} from '../../../context/slices/authSlice';
import {useAppSelector} from '../../../context/store';

export default function SupportEmail() {
  const theme = useTheme();
  // Get active user
  const activeUser = useAppSelector(selectActiveUser);

  const bodyContent =
    `Server: ${CONDUCTOR_URLS.join(', ')} \r` +
    `App Versoin: ${APP_VERSION} \r` +
    `Commit Version: ${COMMIT_HASH ?? 'Not provided.'} \r` +
    `Username: ${activeUser?.username ?? 'Unauthenticated'} \r` +
    `Global Roles: ${
      activeUser?.parsedToken.globalRoles
        ? JSON.stringify(activeUser?.parsedToken.globalRoles)
        : 'Unauthenticated'
    } \r` +
    `Resource Roles: ${
      activeUser?.parsedToken.resourceRoles
        ? JSON.stringify(activeUser?.parsedToken.resourceRoles)
        : 'Unauthenticated'
    }`;

  return (
    <Typography variant="subtitle2" color={theme.palette.grey[900]}>
      Support:{' '}
      <Obfuscate
        className={'support-link'}
        email={SUPPORT_EMAIL}
        headers={{
          subject: `${APP_NAME} Support`,
          body: bodyContent,
        }}
      />
    </Typography>
  );
}
