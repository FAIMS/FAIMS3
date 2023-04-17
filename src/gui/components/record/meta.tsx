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
 * Filename: meta.tsx
 * Description:
 *   TODO
 */

import React, {useEffect} from 'react';
import {
  CircularProgress,
  TableCell,
  Table,
  TableBody,
  TableRow,
  Typography,
} from '@mui/material';

import {
  getRecordMetadata,
  ProjectID,
  RecordID,
  RevisionID,
} from 'faims3-datamodel';

type RecordMetaProps = {
  project_id: ProjectID;
  record_id: RecordID;
  revision_id: RevisionID;
};

export default function RecordMeta(props: RecordMetaProps) {
  const {project_id, record_id, revision_id} = props;
  const [meta, setMeta] = React.useState<{[key: string]: any}>({});

  useEffect(() => {
    async function fetchRecordMeta() {
      const record = await getRecordMetadata(
        project_id,
        record_id,
        revision_id
      );
      setMeta({
        Created: record?.created.toString(),
        Updated: record?.updated.toString(),
        'Created by': record?.created_by,
        'Last updated by': record?.updated_by,
      });
    }
    fetchRecordMeta();
  }, []);

  return (
    <div>
      {Object.keys(meta).length === 0 ? (
        <CircularProgress color={'primary'} size={'0.75rem'} thickness={5} />
      ) : (
        <div>
          <Typography variant={'h5'} gutterBottom>
            Record Metadata
          </Typography>
          <Table size={'small'}>
            <TableBody>
              {Object.keys(meta).map(key => (
                <TableRow key={'record-meta-' + key}>
                  <TableCell>
                    <Typography variant={'overline'}>{key}</Typography>
                  </TableCell>
                  <TableCell>{meta[key]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
