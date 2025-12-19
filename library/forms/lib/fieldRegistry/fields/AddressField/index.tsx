import React, {useState, useCallback} from 'react';
import {
  Collapse,
  IconButton,
  Stack,
  Grid,
  TextField,
  Typography,
  Box,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import z from 'zod';
import {
  BaseFieldPropsSchema,
  FormFieldContextProps,
} from '../../../formModule/types';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';
import {DataViewFieldRender} from '../../../rendering/types';
import {EmptyResponsePlaceholder} from '../../../rendering/fields/view/wrappers/PrimitiveWrappers';

/**
 * AddressType is based on GeocodeJSON, an extension to GeoJSON for storing
 * address data. https://github.com/geocoders/geocodejson-spec/blob/master/draft/README.md
 * This format is returned by some reverse geocoding APIs so should facilitate
 * integration with them.
 */
const AddressSchema = z.object({
  house_number: z.string().optional(),
  road: z.string().optional(),
  suburb: z.string().optional(),
  town: z.string().optional(),
  municipality: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  country: z.string().optional(),
  country_code: z.string().optional(),
});

type AddressType = z.infer<typeof AddressSchema>;

/**
 * The full address value includes both the structured address
 * and a display_name summary string.
 */
const AddressValueSchema = z
  .object({
    display_name: z.string(),
    address: AddressSchema,
  })
  .nullable();

type AddressValue = z.infer<typeof AddressValueSchema>;

/**
 * Props schema for AddressField - uses base field props only.
 */
const AddressFieldPropsSchema = BaseFieldPropsSchema.extend({});

type AddressFieldProps = z.infer<typeof AddressFieldPropsSchema>;
type AddressFieldFullProps = AddressFieldProps & FormFieldContextProps;

/**
 * Build a display name from address parts.
 * Tuned for Australian addresses initially.
 */
function buildDisplayName(address: AddressType): string {
  const parts = [
    address.house_number,
    address.road,
    address.suburb,
    address.state,
    address.postcode,
  ].filter(Boolean);
  return parts.join(', ');
}

/**
 * AddressField - a structured address input field.
 *
 * Features:
 * - Collapsible form with individual address fields
 * - Generates display_name summary from address parts
 * - Based on GeocodeJSON format for future geocoding integration
 * - Tuned for Australian addresses initially
 *
 * TODO: Internationalise using eg. react-country-state-city
 * TODO: Integrate with geocoding API for address lookup
 */
const AddressField: React.FC<AddressFieldFullProps> = props => {
  const {
    state,
    setFieldData,
    handleBlur,
    label,
    helperText,
    required,
    advancedHelperText,
    disabled,
  } = props;

  const currentValue = state.value?.data as AddressValue | null;
  const address = currentValue?.address ?? {};
  const displayName = currentValue?.display_name ?? '';

  // Start collapsed if we have a display name, expanded if empty
  const [collapsed, setCollapsed] = useState(displayName === '' && !disabled);

  const errors = state.meta.errors as unknown as string[];

  /**
   * Update the field value with new address data.
   */
  const updateAddress = useCallback(
    (newAddress: AddressType) => {
      const newDisplayName = buildDisplayName(newAddress);
      setFieldData({
        display_name: newDisplayName,
        address: newAddress,
      });
    },
    [setFieldData]
  );

  /**
   * Create a change handler for a specific address property.
   */
  const updateProperty = useCallback(
    (propName: keyof AddressType) =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const newAddress: AddressType = {
          ...address,
          [propName]: event.target.value,
        };
        updateAddress(newAddress);
      },
    [address, updateAddress]
  );

  const handleEdit = () => {
    if (!disabled) {
      setCollapsed(!collapsed);
    }
  };

  return (
    <FieldWrapper
      heading={label}
      subheading={helperText}
      required={required}
      advancedHelperText={advancedHelperText}
      errors={errors}
    >
      <Box>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={11}>
            <Typography
              variant="body1"
              sx={{
                color: displayName ? 'text.primary' : 'text.secondary',
                fontStyle: displayName ? 'normal' : 'italic',
              }}
            >
              {displayName || 'No address entered'}
            </Typography>
          </Grid>
          <Grid item xs={1}>
            {!disabled && (
              <IconButton onClick={handleEdit} size="small">
                {collapsed ? <ExpandLessIcon /> : <EditIcon />}
              </IconButton>
            )}
          </Grid>
        </Grid>

        <Collapse in={collapsed}>
          <Stack spacing={2} sx={{mt: 2}}>
            <TextField
              label="House Number"
              value={address.house_number ?? ''}
              fullWidth
              variant="outlined"
              onChange={updateProperty('house_number')}
              onBlur={handleBlur}
              disabled={disabled}
            />
            <TextField
              label="Street Name"
              value={address.road ?? ''}
              fullWidth
              variant="outlined"
              onChange={updateProperty('road')}
              onBlur={handleBlur}
              disabled={disabled}
            />
            <TextField
              label="Suburb"
              value={address.suburb ?? ''}
              fullWidth
              variant="outlined"
              onChange={updateProperty('suburb')}
              onBlur={handleBlur}
              disabled={disabled}
            />
            <TextField
              label="State"
              value={address.state ?? ''}
              fullWidth
              variant="outlined"
              onChange={updateProperty('state')}
              onBlur={handleBlur}
              disabled={disabled}
            />
            <TextField
              label="Postcode"
              value={address.postcode ?? ''}
              fullWidth
              variant="outlined"
              onChange={updateProperty('postcode')}
              onBlur={handleBlur}
              disabled={disabled}
            />
          </Stack>
        </Collapse>
      </Box>
    </FieldWrapper>
  );
};

/**
 * View renderer for AddressField.
 * Displays the formatted display_name.
 */
const AddressFieldRenderer: DataViewFieldRender = props => {
  const value = props.value as AddressValue | null;

  if (!value || !value.display_name) {
    return <EmptyResponsePlaceholder />;
  }

  return <Typography>{value.display_name}</Typography>;
};

/**
 * Generate a Zod schema for validating the address field value.
 */
const valueSchema = (props: AddressFieldProps) => {
  if (props.required) {
    // Required: must have at least a display_name
    return AddressValueSchema.refine(
      val => val !== null && val.display_name.trim().length > 0,
      {message: 'Address is required'}
    );
  }
  return AddressValueSchema;
};

/**
 * Field specification for AddressField.
 * Structured street address input based on GeocodeJSON format.
 */
export const addressFieldSpec: FieldInfo<AddressFieldFullProps> = {
  namespace: 'faims-custom',
  name: 'AddressField',
  returns: 'faims-core::JSON',
  component: AddressField,
  fieldPropsSchema: AddressFieldPropsSchema,
  fieldDataSchemaFunction: valueSchema,
  view: {
    component: AddressFieldRenderer,
    config: {},
  },
};
