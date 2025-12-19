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

import {ProjectID} from '@faims3/data-model';
import {Chip} from '@mui/material';
import {selectProjectById} from '../../context/slices/projectSlice';
import {useAppSelector} from '../../context/store';
import { RichTextContent } from '@faims3/forms';

type MetadataProps = {
  project_id: ProjectID;
  // You can force through an explicit value
  explicitValue?: string;
  // OR you can ask for a value by key from the metadata
  metadata_key?: string;
  metadata_label?: string;
  chips?: boolean;
};

export default function MetadataRenderer(props: MetadataProps) {
  const {
    project_id,
    metadata_key,
    metadata_label,
    chips = true,
    explicitValue,
  } = props;
  const metadata = useAppSelector(
    state => selectProjectById(state, project_id)?.metadata
  );
  const possibleValue = explicitValue
    ? explicitValue
    : metadata_key
      ? metadata?.[metadata_key]
      : 'Error';
  const value = possibleValue ? (possibleValue as string) : '';

  // Use RichTextField for 'pre_description' field
  if (metadata_key === 'pre_description' && value !== '') {
    return <RichTextContent content={value} />;
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
