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
 * Filename: Address.tsx
 * Description:
 *   Implements an address field
 */

import React, {useRef, useState} from 'react';
import {FieldProps} from 'formik';
import {
  Collapse,
  IconButton,
  Stack,
  Grid,
  TextField,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import _ from 'lodash';

interface Props {
  helperText?: string;
  label?: string;
  disabled?: boolean;
}

/**
 * AddressType is based on GeocodeJSON an extension to GeoJSON for storing
 * address data.  https://github.com/geocoders/geocodejson-spec/blob/master/draft/README.md
 * This format is returned by some reverse geocoding APIs so should facilitate integration
 * with them.
 */
interface AddressType {
  house_number?: string;
  road?: string;
  town?: string;
  suburb?: string;
  municipality?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
}

/**
 * AddressField - an address field for FAIMS
 * Initial version supports manual input of addresses and provides
 * a summary of the entered value.
 * Tuned for Australian addresses initially.
 * TODO: internationalise, use eg. https://www.npmjs.com/package/react-country-state-city to
 * generate drop-down menus for eg. state and maybe city names
 * TODO: use a geocoding API to do address lookup
 *
 * @param props Component properties
 */
export const AddressField = (props: FieldProps & Props) => {
  const [address, setAddress] = useState<AddressType>(
    props.field.value?.address || {}
  );
  const [displayName, setDisplayName] = useState(
    props.field.value?.display_name || ''
  );
  const [collapsed, setCollapsed] = useState(displayName === '');

  const iconRef = useRef(null);

  const setFieldValue = (a: AddressType) => {
    const parts = [
      a.house_number,
      a.road,
      a.suburb,
      a.state,
      a.postcode,
    ].filter(p => p); // remove undefined elements
    const dn = parts.join(', ');
    setDisplayName(dn);
    setAddress(a);
    props.form.setFieldValue(
      props.field.name,
      {
        display_name: dn,
        address: a,
      },
      true
    );
    props.form.validateForm();
  };

  const updateProperty = (
    propName: string
  ): React.ChangeEventHandler<HTMLInputElement> => {
    return event => {
      const newAddress: any = _.cloneDeep(address); // coerce to any to allow property assignment below
      newAddress[propName] = event.target.value;
      setFieldValue(newAddress);
    };
  };

  const handleEdit = () => {
    if (!props.disabled) setCollapsed(!collapsed);
  };

  return (
    <div>
      <Typography variant="h5">{props.label}</Typography>
      <Grid container spacing={2}>
        <Grid item xs={11}>
          <Typography variant="h5">{displayName}</Typography>
        </Grid>

        <Grid item xs={1}>
          <IconButton ref={iconRef} onClick={handleEdit} size={'small'}>
            {props.disabled ? null : collapsed ? (
              <ExpandLessIcon />
            ) : (
              <EditIcon />
            )}
          </IconButton>
        </Grid>
      </Grid>

      <Collapse in={collapsed}>
        <Stack spacing={2}>
          <div>{props.helperText}</div>

          <TextField
            label="House Number"
            value={address.house_number}
            fullWidth
            onChange={updateProperty('house_number')}
          />
          <TextField
            label="Street Name"
            value={address.road}
            fullWidth
            onChange={updateProperty('road')}
          />
          <TextField
            label="Suburb"
            value={address.suburb}
            fullWidth
            onChange={updateProperty('suburb')}
          />
          <TextField
            label="State"
            value={address.state}
            fullWidth
            onChange={updateProperty('state')}
          />
          <TextField
            label="Postcode"
            value={address.postcode}
            fullWidth
            onChange={updateProperty('postcode')}
          />
        </Stack>
      </Collapse>
    </div>
  );
};
