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
 * Filename: conflicttoolbar.tsx
 * Description:
 *   File contains tools in Conflict Tab
 *    - includes Droplist bar, InfoDialog, Help Dialog
 */
import * as React from 'react';
import {useState} from 'react';
import {Grid, Box, Stack} from '@mui/material';
import {ConflictButton} from './conflictDialog';
import {ConflictDropSelect} from './conflictdroplist';
import {InitialMergeRevisionDetailsMap} from 'faims3-datamodel';
type ConflictToolBarProps = {
  headerlist: InitialMergeRevisionDetailsMap;
  revisionlist: Array<string>;
  setRevisionList: any;
  setR: any;
  setChooseAll: any;
  isloading: boolean;
  istoggleAll: boolean;
  setIstoggleAll: any;
  numResolved: number;
};
export default function ConflictToolBar(props: ConflictToolBarProps) {
  const {headerlist, revisionlist, setRevisionList, setChooseAll, isloading} =
    props;
  const [ischoose, setischoose] = useState(false);
  const onButtonClick = (value: string) => {
    console.log(value);
    setChooseAll(value);
    setischoose(true);
  };

  const setRevision = (revision: string, index: number) => {
    const newrevisionlist = revisionlist;
    newrevisionlist[index] = revision;
    setRevisionList(newrevisionlist);
    props.setR(index + 'R' + revision);
  };

  return (
    <Box sx={{pt: 3, px: 2}} style={{backgroundColor: 'white'}}>
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Stack direction={{xs: 'row', sm: 'row'}} spacing={{xs: 1, sm: 1}}>
            <ConflictDropSelect
              label={'A'}
              headerlist={headerlist}
              revision={revisionlist[0]}
              index={0}
              setRevision={setRevision}
              disablerevision={revisionlist[1]}
              numResolved={props.numResolved}
            />
            <ConflictButton
              onButtonClick={onButtonClick}
              id="A"
              value={'A'}
              text="Choose A"
              ischoose={ischoose}
              disabled={isloading}
            />
          </Stack>
        </Grid>
        <Grid
          item
          xs={6}
          container
          justifyContent="flex-end"
          alignItems="flex-start"
        >
          <Stack direction={{xs: 'row', sm: 'row'}} spacing={{xs: 1, sm: 1}}>
            <ConflictDropSelect
              label={'B'}
              headerlist={headerlist}
              revision={revisionlist[1]}
              index={1}
              setRevision={setRevision}
              disablerevision={revisionlist[0]}
              numResolved={props.numResolved}
            />
            <ConflictButton
              onButtonClick={onButtonClick}
              id="B"
              value={'B'}
              text="Choose B"
              ischoose={ischoose}
              disabled={isloading}
            />
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
