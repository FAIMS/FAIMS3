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
 * Filename: metadataRenderer.tsx
 * Description:
 *   TODO
 */

import React, {useEffect, useState} from 'react';
import {Chip} from '@mui/material';
import {ProjectID} from '@faims3/data-model';
import {getMetadataValue} from '../../sync/metadata';
import {RichTextField} from '../fields/RichText';

type MetadataProps = {
  project_id: ProjectID;
  metadata_key: string;
  metadata_label?: string;
  chips?: boolean;
};

export default function MetadataRenderer(props: MetadataProps) {
  const {project_id, metadata_key, metadata_label, chips = true} = props;
  const [value, setValue] = useState('');

  useEffect(() => {
    getMetadataValue(project_id, metadata_key).then(v => {
      setValue(v as string);
    });
  }, [project_id, metadata_key]);

  // Use RichTextField for 'pre_description' field
  if (metadata_key === 'pre_description' && value !== '') {
    return <RichTextField content={value} />;
  }

  // For other fields, use original rendering logic
  return chips && value !== '' ? (
    <Chip
      size={'small'}
      style={{marginRight: '5px', marginBottom: '5px'}}
      label={
        <>
          {metadata_label && <span>{metadata_label}: </span>}
          <span>{value}</span>
        </>
      }
    />
  ) : (
    <span>
      {metadata_label && <span>{metadata_label}: </span>}
      <span>{value}</span>
    </span>
  );
}
