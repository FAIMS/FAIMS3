import React, {useEffect, useState} from 'react';
import {Geolocation} from '@capacitor/geolocation';
import {Camera, CameraPermissionState} from '@capacitor/camera';
import {Capacitor} from '@capacitor/core';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Paper,
  Alert,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import {PermissionStatus as GeolocationPermissionState} from '@capacitor/geolocation';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import WarningIcon from '@mui/icons-material/Warning';

export type PermissionType = 'camera' | 'geolocation';
export type PermissionState =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'checking'
  | 'bypassed';

export interface PermissionConfig {
  type: PermissionType;
  title: string;
  message: string;
  required: boolean;
  webInstructions?: string[];
}

interface PermissionGateProps {
  children: React.ReactNode;
  permissions: PermissionConfig[];
}

interface PermissionStatus {
  [key: string]: PermissionState;
}

const isWeb = Capacitor.getPlatform() === 'web';

const getPermissionIcon = (type: PermissionType) => {
  switch (type) {
    case 'camera':
      return <CameraAltIcon />;
    case 'geolocation':
      return <LocationOnIcon />;
    default:
      return null;
  }
};

const mapCameraPermissionState = (
  state: CameraPermissionState
): PermissionState => {
  switch (state) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'prompt':
    case 'prompt-with-rationale':
      return 'prompt';
    default:
      return 'denied';
  }
};

const mapGeolocationPermissionState = (
  state: GeolocationPermissionState
): PermissionState => {
  switch (state.location) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'prompt':
      return 'prompt';
    default:
      return 'denied';
  }
};

export const PermissionGate: React.FC<PermissionGateProps> = ({
  children,
  permissions,
}) => {
  const [permissionStates, setPermissionStates] = useState<PermissionStatus>(
    {}
  );
  const [showDialog, setShowDialog] = useState(false);
  const [currentPermissionIndex, setCurrentPermissionIndex] =
    useState<number>(0);
  const [isInitialCheck, setIsInitialCheck] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const findNextNonGrantedPermissionIndex = (
    startIndex: number = 0
  ): number => {
    for (let i = startIndex; i < permissions.length; i++) {
      const permState = permissionStates[permissions[i].type];
      if (permState !== 'granted' && permState !== 'bypassed') {
        return i;
      }
    }
    return -1; // No more permissions needed
  };

  const currentPermission = permissions[currentPermissionIndex];

  const checkPermissions = async () => {
    const states: PermissionStatus = {};

    for (const permission of permissions) {
      try {
        switch (permission.type) {
          case 'camera':
            const cameraStatus = await Camera.checkPermissions();
            states[permission.type] = mapCameraPermissionState(
              cameraStatus.camera
            );
            break;

          case 'geolocation':
            const locationStatus = await Geolocation.checkPermissions();
            states[permission.type] =
              mapGeolocationPermissionState(locationStatus);
            break;
        }
      } catch (error) {
        console.error(`Error checking ${permission.type} permission:`, error);
        states[permission.type] = 'denied';
      }
    }

    setPermissionStates(states);
    return states;
  };

  const areAllPermissionsSatisfied = (states: PermissionStatus): boolean => {
    return permissions.every(
      p => states[p.type] === 'granted' || states[p.type] === 'bypassed'
    );
  };

  const handlePermissionsCheck = (states: PermissionStatus) => {
    if (areAllPermissionsSatisfied(states)) {
      setShowDialog(false);
      return;
    }

    const nextIndex = findNextNonGrantedPermissionIndex();
    if (nextIndex >= 0) {
      setCurrentPermissionIndex(nextIndex);
      setShowDialog(true);
    } else {
      setShowDialog(false);
    }
  };

  const requestPermission = async (permission: PermissionConfig) => {
    setError(null);

    if (isWeb) {
      return;
    }

    try {
      switch (permission.type) {
        case 'camera':
          const cameraResult = await Camera.requestPermissions();
          const cameraState = mapCameraPermissionState(cameraResult.camera);
          setPermissionStates(prev => ({
            ...prev,
            [permission.type]: cameraState,
          }));
          if (cameraState === 'granted') {
            proceedToNextPermission();
          }
          break;

        case 'geolocation':
          const locationResult = await Geolocation.requestPermissions({
            permissions: ['location', 'coarseLocation'],
          });
          const locationState = mapGeolocationPermissionState(locationResult);
          setPermissionStates(prev => ({
            ...prev,
            [permission.type]: locationState,
          }));
          if (locationState === 'granted') {
            proceedToNextPermission();
          }
          break;
      }
    } catch (error: any) {
      setError(error.message || 'Failed to request permission');
      console.error(`Error requesting ${permission.type} permission:`, error);
    }
  };

  const proceedToNextPermission = () => {
    const nextIndex = findNextNonGrantedPermissionIndex(
      currentPermissionIndex + 1
    );
    if (nextIndex >= 0) {
      setCurrentPermissionIndex(nextIndex);
    } else {
      setShowDialog(false);
    }
  };

  const handleDismiss = () => {
    setPermissionStates(prev => ({
      ...prev,
      [currentPermission.type]: 'bypassed',
    }));
    proceedToNextPermission();
  };

  // Initial permission check
  useEffect(() => {
    const initialCheck = async () => {
      const states = await checkPermissions();
      handlePermissionsCheck(states);
      setIsInitialCheck(false);
    };

    initialCheck();
  }, []);

  // Watch for permission state changes
  useEffect(() => {
    if (!isInitialCheck) {
      handlePermissionsCheck(permissionStates);
    }
  }, [permissionStates]);

  if (isInitialCheck) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            textAlign: 'center',
            maxWidth: 400,
            borderRadius: 2,
          }}
        >
          <Typography variant="h5" sx={{mb: 2, fontWeight: 500}}>
            Checking permissions...
          </Typography>
          <Typography color="text.secondary">
            Please wait while we verify app permissions.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <>
      <Dialog open={showDialog} onClose={handleDismiss} maxWidth="sm" fullWidth>
        {currentPermission && (
          <>
            <DialogTitle
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              {getPermissionIcon(currentPermission.type)}
              <Typography variant="h6" component="span">
                {currentPermission.title}
              </Typography>
            </DialogTitle>
            <DialogContent sx={{mt: 2}}>
              <Typography sx={{mb: 2}}>{currentPermission.message}</Typography>

              {isWeb && currentPermission.webInstructions && (
                <>
                  <Alert severity="info" sx={{mb: 2}}>
                    Since you're using a web browser, you'll need to grant
                    permissions manually:
                  </Alert>
                  <Stepper orientation="vertical" sx={{mb: 2}}>
                    {currentPermission.webInstructions.map(
                      (instruction, index) => (
                        <Step key={index} active={true}>
                          <StepLabel>{instruction}</StepLabel>
                        </Step>
                      )
                    )}
                  </Stepper>
                </>
              )}

              {error && (
                <Alert severity="warning" sx={{mb: 2}}>
                  {error}
                </Alert>
              )}
            </DialogContent>
            <DialogActions sx={{px: 3, pb: 2, gap: 1}}>
              <Button
                onClick={handleDismiss}
                color="inherit"
                startIcon={<WarningIcon />}
              >
                Continue Without Permission
              </Button>
              {!isWeb && (
                <Button
                  onClick={() => requestPermission(currentPermission)}
                  variant="contained"
                  color="primary"
                  startIcon={getPermissionIcon(currentPermission.type)}
                >
                  Grant Permission
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
      {children}
    </>
  );
};
