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

import {ProjectID} from '../../../datamodel';
import {
  CircularProgress,
  TableCell,
  Table,
  TableBody,
  TableRow,
} from '@material-ui/core';
import {observationMetadataTracker} from '../../../observationMetadata';
import {useDBTracker} from '../../pouchHook';
type ObservationMetaProps = {
  project_id: ProjectID;
  observation_id: string;
};

export default function ObservationMeta(props: ObservationMetaProps) {
  const {project_id, observation_id} = props;
  const meta = useDBTracker(observationMetadataTracker, [
    project_id,
    observation_id,
  ] as [string, string]);

  return (
    <div>
      {meta.match(
        meta => (
          <div>
            <Table>
              <TableBody>
                {Object.keys(meta).map(key => (
                  <TableRow key={'observation-meta-' + key}>
                    <TableCell>
                      <b>{key}</b>
                    </TableCell>
                    <TableCell>{meta[key].toString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ),
        err => (
          <span>Error: {err.toString()}</span>
        ),
        loading => (
          <CircularProgress color={'primary'} size={'0.75rem'} thickness={5} />
        )
      )}
    </div>
  );
}
