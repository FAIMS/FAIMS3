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
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Collapse,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import _ from 'lodash';

interface Props {
  helperText?: string;
  label?: string;
}

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

export const AddressField = (props: FieldProps & Props) => {
  const [address, setAddress] = useState<AddressType>(
    props.field.value.address || {}
  );
  const [displayName, setDisplayName] = useState(
    props.field.value.display_name || ''
  );
  const [collapsed, setCollapsed] = useState(displayName === '');

  const setFieldValue = (a: AddressType) => {
    const dn = `${a.house_number || ''} ${a.road || ''}, ${a.suburb || ''}, ${a.state || ''} ${a.postcode || ''}`;
    setDisplayName(dn);
    setAddress(a);
    props.form.setFieldValue(props.field.name, {
      display_name: dn,
      address: a,
    });
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
    setCollapsed(!collapsed);
  };

  return (
    <div>
      <Typography variant="h4">
        {displayName}
        <IconButton onClick={handleEdit} size={'small'}>
          <EditIcon />
        </IconButton>
      </Typography>

      <Collapse in={collapsed}>
        <Stack spacing={2}>
          <div>{props.label}</div>
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
