import {Box} from '@mui/material';
import React from 'react';
import {grey} from '@mui/material/colors';

type BoxTabProps = {
  title: string;
  bgcolor: string;
};
export default function BoxTab(props: BoxTabProps) {
  return (
    <Box
      bgcolor={props.bgcolor}
      style={{
        borderTopLeftRadius: '4px',
        borderTopRightRadius: '4px',
        width: 'fit-content',
        fontSize: '10px',
        padding: '5px 8px 5px 8px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
      }}
    >
      <code>{props.title}</code>
    </Box>
  );
}
BoxTab.defaultProps = {
  bgcolor: grey[200],
};
