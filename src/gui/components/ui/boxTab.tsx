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
 * Filename: boxTab.tsx
 * Description: 
 *   TODO
 */
 
import grey from '@material-ui/core/colors/grey';
import {Box} from '@material-ui/core';
import React from 'react';

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
