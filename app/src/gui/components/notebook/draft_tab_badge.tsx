import React, {useEffect} from 'react';
import {Badge, CircularProgress} from '@mui/material';
import {listenDrafts} from '../../../drafts';
import _ from 'lodash';
import {ProjectID} from 'faims3-datamodel';

export default function DraftTabBadge(props: {project_id: ProjectID}) {
  const {project_id} = props;
  const [draftCount, setDraftCount] = React.useState(0);
  const [isLoading, setLoading] = React.useState(true);

  useEffect(() => {
    //  Dependency is only the project_id, ie., register one callback for this component
    // on load - if the record list is updated, the callback should be fired
    if (project_id === undefined) return; //dummy project
    const destroyListener = listenDrafts(
      project_id,
      'all',
      newPouchRecordList => {
        setLoading(false);
        if (!_.isEqual(Object.values(newPouchRecordList).length, draftCount)) {
          setDraftCount(Object.values(newPouchRecordList).length);
        }
      }
    );

    return destroyListener; // destroyListener called when this component unmounts.
  }, [project_id, draftCount]);

  return (
    <Badge
      badgeContent={
        isLoading ? (
          <CircularProgress size={10} sx={{color: 'white'}} thickness={6} />
        ) : (
          draftCount
        )
      }
      color="primary"
    >
      <span style={{paddingRight: '10px'}}>Drafts{'  '}</span>
    </Badge>
  );
}
