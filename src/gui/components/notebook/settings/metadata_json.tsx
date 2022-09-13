import React from 'react';
import {Box} from '@mui/material';
import {grey} from '@mui/material/colors';
interface MetaDataJsonComponentProps {
  value: any;
}
export default function MetaDataJsonComponent(
  props: MetaDataJsonComponentProps
) {
  return (
    <React.Fragment>
      <Box
        bgcolor={grey[100]}
        px={2}
        style={{overflowX: 'scroll', width: '100%'}}
      >
        <pre>{JSON.stringify(props.value, null, 2)}</pre>
      </Box>
    </React.Fragment>
  );
}
