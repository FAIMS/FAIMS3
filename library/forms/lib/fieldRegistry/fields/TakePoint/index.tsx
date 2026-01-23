/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * TakePoint Component
 *
 * This component captures the user's current GPS location using device geolocation.
 * It stores the location as a GeoJSON Feature with Point geometry.
 *
 * Features:
 * - Captures current GPS coordinates with configurable accuracy settings
 * - Stores additional metadata: altitude, speed, heading, accuracy
 * - Displays captured coordinates in a readable format
 * - Handles permission errors gracefully
 *
 * Props:
 * - label (string, optional): Button text (default: 'Take Point').
 * - helperText (string, optional): Instructions displayed above the button.
 * - enableHighAccuracy (boolean, optional): Request high accuracy GPS (default: true).
 * - timeout (number, optional): Maximum time to wait for position in ms (default: 10000).
 * - maximumAge (number, optional): Maximum age of cached position in ms (default: 0).
 * - required: To visually show if the field is required.
 * - disabled: Whether the field is disabled.
 */

import {Geolocation, Position} from '@capacitor/geolocation';
import {FAIMSPosition, logError} from '@faims3/data-model';
import LocationOn from '@mui/icons-material/LocationOn';
import {Alert, Box, Paper, Typography} from '@mui/material';
import Button from '@mui/material/Button';
import {useTheme} from '@mui/material/styles';
import {useState} from 'react';
import {z} from 'zod';
import {LocationPermissionIssue} from '../../../components/PermissionAlerts';
import {BaseFieldPropsSchema, FullFieldProps} from '../../../formModule/types';
import {MapRenderer} from '../../../rendering/fields/view/specialised/Mapping';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';

// ============================================================================
// Types & Schema
// ============================================================================

const TakePointFieldPropsSchema = BaseFieldPropsSchema.extend({
  buttonLabelText: z.string().optional(),
  enableHighAccuracy: z.boolean().optional(),
  timeout: z.number().optional(),
  maximumAge: z.number().optional(),
});

type TakePointFieldProps = z.infer<typeof TakePointFieldPropsSchema>;
type FieldProps = TakePointFieldProps & FullFieldProps;

// GeoJSON Feature schema for the stored value
const FAIMSPositionSchema = z.object({
  type: z.literal('Feature'),
  properties: z.object({
    timestamp: z.number(),
    altitude: z.number().nullable(),
    speed: z.number().nullable(),
    heading: z.number().nullable(),
    accuracy: z.number(),
    altitude_accuracy: z.number().nullable(),
  }),
  geometry: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number(), z.number()]), // [longitude, latitude]
  }),
});

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Converts Capacitor Position coordinates to FAIMS GeoJSON Feature format.
 */
function capacitorCoordinatesToFaimsPosition(
  coordinates: Position
): FAIMSPosition {
  const position = coordinates.coords;
  const timestamp = coordinates.timestamp;
  return {
    type: 'Feature',
    properties: {
      timestamp: timestamp,
      altitude: position.altitude ?? null,
      speed: position.speed ?? null,
      heading: position.heading ?? null,
      accuracy: position.accuracy,
      altitude_accuracy: position.altitudeAccuracy ?? null,
    },
    geometry: {
      type: 'Point',
      coordinates: [position.longitude, position.latitude],
    },
  };
}

// ============================================================================
// Sub-Components
// ============================================================================

interface PositionDisplayProps {
  position: FAIMSPosition;
}

/**
 * Displays the captured position data in a formatted layout.
 */
const PositionDisplay = ({position}: PositionDisplayProps) => {
  const theme = useTheme();
  const {geometry, properties} = position;

  const formatValue = (
    value: number | null,
    unit?: string,
    decimalPlaces?: number
  ): string => {
    if (value === null || value === undefined) {
      return 'Not captured';
    }
    return unit
      ? `${value.toFixed(decimalPlaces ?? 6)} ${unit}`
      : value.toFixed(6);
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        mt: 2,
        backgroundColor: theme.palette.grey[50],
      }}
    >
      <Typography variant="subtitle2" gutterBottom>
        Captured Location
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: 0.5,
          '& > dt': {fontWeight: 500, color: 'text.secondary'},
          '& > dd': {margin: 0},
        }}
        component="dl"
      >
        <dt>Latitude:</dt>
        <dd>{formatValue(geometry.coordinates[1])}</dd>
        <dt>Longitude:</dt>
        <dd>{formatValue(geometry.coordinates[0])}</dd>
        <dt>Accuracy:</dt>
        <dd>{formatValue(properties.accuracy, 'm', 2)}</dd>
        <dt>Altitude:</dt>
        <dd>{formatValue(properties.altitude, 'm')}</dd>
      </Box>
    </Paper>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * TakePoint Component - Captures current GPS location and stores as GeoJSON Feature.
 */
export const TakePoint = (props: FieldProps) => {
  const {
    label,
    buttonLabelText,
    helperText,
    required,
    advancedHelperText,
    disabled,
    state,
    setFieldData,
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 0,
  } = props;

  // Button label: use buttonLabelText if provided, otherwise fall back to label or default
  const buttonLabel = buttonLabelText ?? label ?? 'Take Point';

  const [noPermission, setNoPermission] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const position = state.value?.data as FAIMSPosition | null | undefined;
  // TODO: error handling
  const error = undefined;

  const appName =
    props.config.mode === 'full' ? props.config.appName : 'FAIMS3';

  /**
   * Captures the current GPS position and stores it in the field.
   */
  const takePoint = async () => {
    setIsCapturing(true);
    setNoPermission(false);

    try {
      const coordinates = capacitorCoordinatesToFaimsPosition(
        await Geolocation.getCurrentPosition({
          enableHighAccuracy,
          timeout,
          maximumAge,
        })
      );
      setFieldData(coordinates);
    } catch (err: any) {
      logError(err);
      setNoPermission(true);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <FieldWrapper
      heading={label}
      subheading={helperText ?? 'Click to save current location'}
      required={required}
      advancedHelperText={advancedHelperText}
      errors={props.state.meta.errors as unknown as string[]}
    >
      <Box sx={{mt: 1.5}}>
        <Button
          variant="contained"
          color="primary"
          disabled={disabled || isCapturing}
          onClick={takePoint}
          startIcon={<LocationOn />}
          sx={{
            width: {xs: '100%', sm: 'auto'},
            padding: '10px 20px',
            minHeight: '44px',
            fontSize: '14px',
            fontWeight: 600,
            borderRadius: '8px',
            boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.15)',
            textTransform: 'none',
            '&:hover': {
              boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.2)',
            },
          }}
        >
          {isCapturing ? 'Capturing...' : buttonLabel}
        </Button>

        {/* Display captured position */}
        {position?.geometry && <PositionDisplay position={position} />}

        {/* Error display */}
        {error && (
          <Alert severity="error" sx={{mt: 2}}>
            {error}
          </Alert>
        )}

        {/* Permission error */}
        {noPermission && <LocationPermissionIssue appName={appName} />}
      </Box>
    </FieldWrapper>
  );
};

// ============================================================================
// Value Schema
// ============================================================================

/**
 * Generate a zod schema for the value.
 * The value is a GeoJSON Feature with Point geometry, or null if not captured.
 */
const valueSchema = (props: TakePointFieldProps) => {
  if (props.required) {
    // Required: must have a valid position (FAIMSPositionSchema doesn't allow
    // null)
    return FAIMSPositionSchema;
  }
  // Optional: allow null for no position captured
  return z.union([FAIMSPositionSchema, z.null()]);
};

// ============================================================================
// Field Registration
// ============================================================================

/**
 * Export a constant with the information required to register this field type
 */
export const takePointFieldSpec: FieldInfo<FieldProps> = {
  namespace: 'faims-custom',
  name: 'TakePoint',
  returns: 'faims-pos::Location',
  component: TakePoint,
  fieldPropsSchema: TakePointFieldPropsSchema,
  fieldDataSchemaFunction: valueSchema,
  view: {component: MapRenderer, config: {}},
};
