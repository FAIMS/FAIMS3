// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: meta.tsx
 * Description:
 *   TODO
 */

import {
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material';
import React, {useEffect} from 'react';

import {
  getRecordMetadata,
  ProjectID,
  RecordID,
  RevisionID,
} from '@faims3/data-model';
import {compiledSpecService} from '../../../context/slices/helpers/compiledSpecService';
import {selectAllProjects} from '../../../context/slices/projectSlice';
import {useAppSelector} from '../../../context/store';
import {localGetDataDb} from '../../../utils/database';

type RecordMetaProps = {
  project_id: ProjectID;
  record_id: RecordID;
  revision_id: RevisionID;
};

export default function RecordMeta(props: RecordMetaProps) {
  const {project_id, record_id, revision_id} = props;
  const [meta, setMeta] = React.useState<{[key: string]: any}>({});
  const uiSpecId = useAppSelector(selectAllProjects).find(
    p => p.projectId === project_id
  )?.uiSpecificationId;
  const uiSpec = uiSpecId ? compiledSpecService.getSpec(uiSpecId) : undefined;

  useEffect(() => {
    if (!uiSpec) return;
    const uiSpecification = uiSpec;

    async function fetchRecordMeta() {
      const record = await getRecordMetadata({
        projectId: project_id,
        recordId: record_id,
        revisionId: revision_id,
        dataDb: localGetDataDb(project_id),
        uiSpecification,
      });
      setMeta({
        Created: record?.created.toString(),
        Updated: record?.updated.toString(),
        'Created by': record?.created_by,
        'Last updated by': record?.updated_by,
      });
    }
    fetchRecordMeta();
  }, [project_id, record_id, revision_id, uiSpec]);

  if (!uiSpec) {
    return <p>Error... could not find ui specification.</p>;
  }

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
