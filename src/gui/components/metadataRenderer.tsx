/*
 * Copyright 2021 Macquarie University
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
import {CircularProgress, Chip} from '@material-ui/core';

import {getProjectMetadata} from '../../projectMetadata';
import {ProjectID} from '../../datamodel/core';

type MetadataProps = {
  project_id: ProjectID;
  metadata_key: string;
  metadata_label?: string;
  chips?: boolean;
};

export default function MetadataRenderer(props: MetadataProps) {
  const project_id = props.project_id;
  const metadata_key = props.metadata_key;
  const metadata_label = props.metadata_label;
  const chips = props.chips ?? true;
  const [metadata_value, setMetadata] = useState(null as string | null);

  useEffect(() => {
    const getMeta = async () => {
      try {
        const meta = await getProjectMetadata(project_id, metadata_key);
        setMetadata(meta);
      } catch (err) {
        setMetadata('Unknown');
      }
    };
    getMeta();
    console.log(metadata_value)
  }, []);

  return chips ? (
    metadata_value? <Chip
      size={'small'}
      style={{marginRight: '5px', marginBottom: '5px'}}
      label={
        <React.Fragment>
          {metadata_label ? (
            <span>{metadata_label}: </span>
          ) : (
            <React.Fragment />
          )}
          {metadata_value ? (
            <span>{metadata_value}</span>
          ) : (
            <CircularProgress size={12} thickness={4} />
          )}
        </React.Fragment>
      }
    />:<> </>
  ) : (
    <>{metadata_value}</>
  );
}
