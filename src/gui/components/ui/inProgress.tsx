import TimelapseIcon from '@material-ui/icons/Timelapse';
import React from 'react';

export default function InProgress() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <TimelapseIcon color={'secondary'} />
      &nbsp;&nbsp;<span>Feature in progress</span>
    </div>
  );
}
