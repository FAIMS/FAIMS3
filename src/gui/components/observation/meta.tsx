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
 * Filename: meta.tsx
 * Description:
 *   TODO
 */

import React, {useEffect} from 'react';
import {ProjectID} from '../../../datamodel';
import {
  CircularProgress,
  TableCell,
  Table,
  TableBody,
  TableRow,
} from '@material-ui/core';
import {lookupFAIMSDataID} from '../../../dataStorage';
type ObservationMetaProps = {
  project_id: ProjectID;
  observation_id: string;
};

export default function ObservationMeta(props: ObservationMetaProps) {
  const {project_id, observation_id} = props;
  const [meta, setMeta] = React.useState<{[key: string]: any}>({});

  useEffect(() => {
    async function fetchObservationMeta() {
      const observation = await lookupFAIMSDataID(project_id, observation_id);
      setMeta({
        Created: observation?.created.toString(),
        Updated: observation?.updated.toString(),
        'Created by': observation?.created_by,
        'Last updated by': observation?.updated_by,
      });
    }
    fetchObservationMeta();
  }, []);

  return (
    <div>
      {Object.keys(meta).length === 0 ? (
        <CircularProgress color={'primary'} size={'0.75rem'} thickness={5} />
      ) : (
        <div>
          <Table>
            <TableBody>
              {Object.keys(meta).map(key => (
                <TableRow>
                  <TableCell>
                    <b>{key}</b>
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
