import {Typography} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import Obfuscate from 'react-obfuscate';
import {COMMIT_VERSION, CONDUCTOR_URLS} from '../../../buildconfig';
import {selectActiveUser} from '../../../context/slices/authSlice';
import {useAppSelector} from '../../../context/store';

export default function SupportEmail() {
  const theme = useTheme();
  // Get active user
  const activeUser = useAppSelector(selectActiveUser);

  let supportEmail = 'support@fieldmark.au';
  if (
    import.meta.env.VITE_COMMIT_VERSION !== undefined &&
    import.meta.env.VITE_COMMIT_VERSION.includes('psmip')
  ) {
    supportEmail = 'support@fieldmark.au';
  }
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
        email={supportEmail}
        headers={{
          subject: 'Fieldmark Support',
          body: bodyContent,
        }}
      />
    </Typography>
  );
}
