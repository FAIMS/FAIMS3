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
