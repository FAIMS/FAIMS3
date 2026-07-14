import {Typography} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import Obfuscate from 'react-obfuscate';
import {config} from '../../../buildconfig';
import {selectActiveUser} from '../../../context/slices/authSlice';
import {useAppSelector} from '../../../context/store';

export default function SupportEmail() {
  const theme = useTheme();
  // Get active user
  const activeUser = useAppSelector(selectActiveUser);

  const bodyContent =
    `Server: ${config.conductorUrls.join(', ')} \r` +
    `App Version: ${config.appVersion} \r` +
    `Commit Version: ${config.commitHash ?? 'Not provided.'} \r` +
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
        email={config.supportEmail}
        headers={{
          subject: `${config.appName} Support`,
          body: bodyContent,
        }}
      />
    </Typography>
  );
}
