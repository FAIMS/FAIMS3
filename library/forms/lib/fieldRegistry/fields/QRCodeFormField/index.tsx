/**
 * QRCodeFormField
 *
 * A form field for scanning QR codes using the device camera.
 * Stores the scanned value as a string.
 *
 * Uses @capacitor-mlkit/barcode-scanning for native scanning.
 * Scanning is only supported on native mobile platforms (iOS/Android).
 */
import React from 'react';
import {z} from 'zod';
import {Box, Typography} from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import FieldWrapper from '../wrappers/FieldWrapper';
import QRCodeButton from '../../../components/qrCodes/QRCodeButton';
import {BaseFieldPropsSchema, FullFieldProps} from '../../../formModule/types';
import {
  DataViewFieldRender,
  EmptyResponsePlaceholder,
} from '../../../rendering/fields';
import {FieldReturnType, FieldInfo} from '../../types';

// =============================================================================
// Props Schema
// =============================================================================

const qrCodeFieldPropsSchema = BaseFieldPropsSchema.extend({});

type QRCodeFieldProps = z.infer<typeof qrCodeFieldPropsSchema>;

// Full props including injected form context
type QRCodeFieldFullProps = QRCodeFieldProps & FullFieldProps;

// =============================================================================
// Edit Component
// =============================================================================

const QRCodeFormField: React.FC<QRCodeFieldFullProps> = props => {
  const {
    label,
    helperText,
    required,
    advancedHelperText,
    disabled,
    state,
    setFieldData,
    handleBlur,
    config,
  } = props;

  // Handle preview mode
  if (config.mode === 'preview') {
    return (
      <FieldWrapper heading={label} subheading={helperText}>
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
          <QRCodeButton
            label={label ?? 'Scan QR Code'}
            disabled
            onScanResult={() => {}}
          />
          <Typography variant="body2" color="text.secondary">
            In full mode, this button opens the camera to scan QR codes and
            barcodes. The scanned value is stored as text.
          </Typography>
        </Box>
      </FieldWrapper>
    );
  }

  // Get current value and errors
  const value = (state.value?.data as string | null) ?? '';
  const errors = state.meta.errors as unknown as string[] | undefined;

  const handleScanResult = (scannedValue: string) => {
    setFieldData(scannedValue);
    handleBlur(); // Mark field as touched
  };

  return (
    <FieldWrapper
      heading={label}
      subheading={helperText}
      required={required}
      advancedHelperText={advancedHelperText}
      errors={errors}
    >
      <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
        <QRCodeButton
          label={label ?? 'Scan QR Code'}
          onScanResult={handleScanResult}
          disabled={disabled}
        />

        {/* Display scanned value */}
        {value && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 1.5,
              bgcolor: 'grey.100',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'grey.300',
            }}
          >
            <QrCode2Icon sx={{color: 'text.secondary', flexShrink: 0}} />
            <Typography
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                wordBreak: 'break-all',
              }}
            >
              {value}
            </Typography>
          </Box>
        )}
      </Box>
    </FieldWrapper>
  );
};

// =============================================================================
// View Component
// =============================================================================

const QRCodeFieldRenderer: DataViewFieldRender = props => {
  const {value} = props;

  if (!value) {
    return <EmptyResponsePlaceholder />;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <QrCode2Icon
        sx={{
          color: 'text.secondary',
          flexShrink: 0,
        }}
      />
      <Typography
        sx={{
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          wordBreak: 'break-all',
          bgcolor: 'grey.50',
          px: 1,
          py: 0.5,
          borderRadius: 0.5,
          border: '1px solid',
          borderColor: 'grey.200',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
};

// =============================================================================
// Validation Schema Function
// =============================================================================

const qrCodeDataSchemaFunction = (props: QRCodeFieldProps) => {
  let schema = z.string();

  if (props.required) {
    schema = schema.min(1, {message: 'This field is required'});
  }

  return schema;
};

// =============================================================================
// Field Spec
// =============================================================================

const NAMESPACE = 'qrcode';
const RETURN_TYPE: FieldReturnType = 'faims-core::String';

export const qrCodeFieldSpec: FieldInfo<QRCodeFieldFullProps> = {
  namespace: NAMESPACE,
  name: 'QRCodeFormField',
  returns: RETURN_TYPE,
  component: QRCodeFormField,
  view: {
    component: QRCodeFieldRenderer,
    config: {},
    attributes: {singleColumn: false},
  },
  fieldPropsSchema: qrCodeFieldPropsSchema,
  fieldDataSchemaFunction: qrCodeDataSchemaFunction,
};
