// SPDX-License-Identifier: Apache-2.0
import {Box} from '@mui/material';
import React from 'react';
import {grey} from '@mui/material/colors';

type BoxTabProps = {
  title: string;
  bgcolor?: string;
};
export default function BoxTab(props: BoxTabProps) {
  return (
    <Box
      sx={{
        bgcolor: props.bgcolor || grey[200],
        borderTopLeftRadius: '4px',
        borderTopRightRadius: '4px',
        width: 'fit-content',
        maxWidth: '100%',
        fontSize: '10px',
        padding: '5px 8px 5px 8px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        overflowWrap: 'anywhere',
      }}
    >
      <code>{props.title}</code>
    </Box>
  );
}
