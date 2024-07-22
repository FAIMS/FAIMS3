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
 * Filename: main-card.tsx
 * Description:
 *   Based on the free mantis dashboard template MainCard component: https://github.com/codedthemes/mantis-free-react-admin-template
 */

import React from 'react';
import {useTheme} from '@mui/material/styles';
import {Card, CardContent, CardHeader, Divider} from '@mui/material';

interface MainCardProps {
  border?: boolean;
  boxShadow?: boolean;
  contentSX?: object;

  divider?: boolean;
  elevation?: number;
  secondary?: React.ReactNode;
  shadow?: string;
  sx?: object;
  title?: string | React.ReactNode;
  content?: boolean;
  children: React.ReactNode;
}
// ==============================|| CUSTOM - MAIN CARD ||============================== //
export default function MainCard(props: MainCardProps) {
  const theme = useTheme();
  const {
    border,
    boxShadow,
    contentSX,
    divider,
    elevation,
    secondary,
    shadow,
    sx,
    title,
    content,
    children,
  } = props;
  return (
    <Card
      elevation={elevation || 0}
      sx={{
        ...sx,
        border: border ? '1px solid' : 'none',
        borderRadius: 2,
        borderColor:
          theme.palette.mode === 'dark'
            ? theme.palette.divider
            : theme.palette.grey['200'],
        boxShadow:
          boxShadow && (!border || theme.palette.mode === 'dark')
            ? shadow
            : 'inherit',
        ':hover': {
          boxShadow: boxShadow ? shadow : 'inherit',
        },
        '& pre': {
          m: 0,
          p: '16px !important',
          fontFamily: theme.typography.fontFamily,
          fontSize: '0.75rem',
        },
        borderTop: 'solid 3px ' + theme.palette.secondary.main,
      }}
    >
      {/* card header and action */}
      {title && (
        <CardHeader
          sx={{
            p: 2.5,
            '& .MuiCardHeader-action': {m: '0px auto', alignSelf: 'center'},
            // backgroundColor: theme.palette.grey[200]
          }}
          titleTypographyProps={{variant: 'subtitle1'}}
          title={title}
          action={secondary}
        />
      )}

      {/* content & header divider */}
      {title && divider && <Divider />}

      {/* card content */}
      {content && <CardContent sx={contentSX}>{children}</CardContent>}
      {!content && children}
    </Card>
  );
}

MainCard.defaultProps = {
  border: true,
  boxShadow: true,
  darkTitle: true,
  contentSX: {},
  divider: true,
};
