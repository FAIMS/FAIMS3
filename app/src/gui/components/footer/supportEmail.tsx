import {Typography} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import Obfuscate from 'react-obfuscate';
import {
  COMMIT_VERSION,
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
    `Commit Version: ${COMMIT_VERSION} \r` +
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
          subject: 'Fieldmark Support',
          body: bodyContent,
        }}
      />
    </Typography>
  );
}
