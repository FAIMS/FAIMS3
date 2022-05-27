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
 * Filename: confictform.tsx
 * Description:
 *   TODO
 */

import React, {useEffect} from 'react';
import {useState} from 'react';
import {ProjectID, RecordID, RevisionID} from '../../../../datamodel/core';
import {ProjectUIModel, Record} from '../../../../datamodel/ui';
import TabContext from '@mui/lab/TabContext';
import TabPanel from '@mui/lab/TabPanel';
import RecordTabBar from './recordTab';
import {InitialMergeDetails} from '../../../../data_storage/merging';
import {getFullRecordData} from '../../../../data_storage';
import {CircularProgress} from '@mui/material';

import {grey} from '@mui/material/colors';
import ConflictPanel from './conflictpannel';
import ConflictToolBar from './conflicttoolbar';
import {Grid} from '@mui/material';
type ConflictFormProps = {
  project_id: ProjectID;
  record_id: RecordID;
  // Might be given in the URL:
  view_default?: string;
  ui_specification: ProjectUIModel;
  metaSection?: any;
  revision_id?: null | RevisionID;
  type: string;
  conflicts: InitialMergeDetails;
};
type isclicklist = {[key: string]: boolean};
type iscolourList = {[key: string]: string};

export default function ConflictForm(props: ConflictFormProps) {
  const [tabvalue, setValue] = useState('0');
  const {ui_specification, project_id, record_id, type, conflicts} = props;
  const handleChange = (event: React.ChangeEvent<{}>, newValue: string) => {
    setValue(newValue);
  };

  const [conflictA, setConflictA] = useState(conflicts['initial_head_data']);
  const [conflictB, setsetConflictB] = useState(null as Record | null);
  const [chosenvalues, setChoosenvalues] = useState(
    conflicts['initial_head_data']
  );

  const fieldslist: Array<string> = [];
  ui_specification['viewsets'][type]['views'].map((view: string) =>
    ui_specification['views'][view]['fields'].map(field =>
      fieldslist.push(field)
    )
  );
  const isclick: isclicklist = {};
  fieldslist.map(field => (isclick[field] = false));
  const iscolour: iscolourList = {};
  fieldslist.map(field => (iscolour[field] = 'default'));
  const [isclickLeft, setIsClickLeft] = useState(isclick);
  const [isclickRight, setIsClickRight] = useState(isclick);
  const [styletypeLeft, setstyletypeLeft] = useState(iscolour);
  const [styletypeRight, setstyletypeRight] = useState(iscolour);
  const ismcolour: iscolourList = {};
  fieldslist.map(field => (ismcolour[field] = 'warning'));
  const [styletypeMiddle, setstyletypeMiddle] = useState(ismcolour);
  const [revisionlist, setRevisionList] = useState([
    conflicts['initial_head'],
    '',
  ]);
  const [comparedrevision, setR] = useState('');
  const [isloading, setIsloading] = useState(true);

  useEffect(() => {
    const getConflict = async () => {
      if (conflicts !== null && revisionlist[1] !== '') {
        setsetConflictB(null);
        setIsloading(true);
        console.log(comparedrevision);
        getFullRecordData(project_id, record_id, revisionlist[1]).then(
          retuslt => {
            setsetConflictB(retuslt);
            setIsloading(false);
          }
        );
      }
    };
    getConflict();
  }, [comparedrevision]);

  if (ui_specification === null || conflicts === null)
    return <CircularProgress size={12} thickness={4} />;
  if (
    conflicts['available_heads'] === undefined ||
    conflicts['available_heads'].length <= 1
  )
    return (
      <Grid
        container
        style={{height: '300px'}}
        justifyContent="center"
        alignItems="center"
      >
        {' '}
        No conclict{' '}
      </Grid>
    );

  const setFieldChanged = (
    isclick: boolean,
    fieldName: string,
    sleft: string,
    smiddle: string,
    sright: string,
    choosevalueA: boolean,
    left: boolean
  ) => {
    if (sleft !== null)
      setstyletypeLeft({...styletypeLeft, [fieldName]: sleft});
    if (smiddle !== null)
      setstyletypeMiddle({...styletypeMiddle, [fieldName]: smiddle});
    if (sright !== null)
      setstyletypeRight({...styletypeRight, [fieldName]: sright});
    if (chosenvalues !== null) {
      const newvalues = chosenvalues['data'];
      if (choosevalueA === true && conflicts !== null && newvalues !== null) {
        newvalues[fieldName] = conflictA['data'][fieldName];
      } else if (
        choosevalueA === false &&
        conflicts !== null &&
        newvalues !== null
      ) {
        if (conflictB !== null)
          newvalues[fieldName] = conflictB['data'][fieldName];
      } else if (
        choosevalueA === null &&
        left &&
        isclickRight[fieldName] === true
      ) {
        setstyletypeMiddle({...styletypeMiddle, [fieldName]: 'delete'});
      } else if (
        choosevalueA === null &&
        left === false &&
        isclickLeft[fieldName] === true
      ) {
        setstyletypeMiddle({...styletypeMiddle, [fieldName]: 'delete'});
      }
      setChoosenvalues({...chosenvalues, data: {...newvalues}});
      console.log(
        '+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++'
      );
      console.log(chosenvalues);
      console.log(newvalues);
    }
    if (left) {
      setIsClickLeft({...isclickLeft, [fieldName]: true});
      if (choosevalueA !== null)
        setIsClickRight({...isclickRight, [fieldName]: true});
    } else {
      setIsClickRight({...isclickRight, [fieldName]: true});
      if (choosevalueA !== null)
        setIsClickLeft({...isclickRight, [fieldName]: true});
    }
  };

  const setChooseAll = (value: string) => {
    const newleft: iscolourList = {};
    const newright: iscolourList = {};
    const newclick = isclick;

    if (value === 'A') {
      fieldslist.map(fieldName => {
        newleft[fieldName] = 'success';
        newright[fieldName] = 'reject';
        newclick[fieldName] = true;
      });
      setstyletypeLeft({...newleft});
      setstyletypeMiddle({...newleft});
      setstyletypeRight({...newright});
      setIsClickLeft({...newclick});
      setIsClickRight({...newclick});
      setChoosenvalues({...chosenvalues, data: {...conflictA['data']}});
    } else if (value === 'B') {
      fieldslist.map(fieldName => {
        newleft[fieldName] = 'reject';
        newright[fieldName] = 'success';
        newclick[fieldName] = true;
      });
      setstyletypeLeft({...newleft});
      setstyletypeRight({...newright});
      setstyletypeMiddle({...newright});
      setIsClickLeft({...newclick});
      setIsClickRight({...newclick});
      if (conflictB !== null)
        setChoosenvalues({...chosenvalues, data: {...conflictB['data']}});
    }
  };

  console.log(
    '+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++Revisions'
  );
  console.log(conflicts);

  const onButtonSave = () => {
    alert('saved');
    // remove two revisions from headers
    // check if headers not empty
    // direct user to new conflict resolving or edit tab
  };

  return (
    <Grid style={{minWidth:'800px',overflowX: 'auto'}} >
      <ConflictToolBar
        headerlist={conflicts['available_heads']}
        revisionlist={revisionlist}
        setRevisionList={setRevisionList}
        setR={setR}
        setChooseAll={setChooseAll}
        isloading={isloading}
      />
      <TabContext value={tabvalue}>
        <RecordTabBar
          handleChange={handleChange}
          ui_specification={ui_specification}
          type={type}
        />
        {conflicts !== null &&
          ui_specification['viewsets'][type]['views'].map((tab, index) => (
            <TabPanel
              key={index + 'conflict_tabpanel'}
              value={index.toString()}
              style={{backgroundColor: grey[200], padding: '0px'}}
            >
              <div style={{padding: '10px 2px'}}>
                <ConflictPanel
                  ui_specification={ui_specification}
                  type={type}
                  view={ui_specification['viewsets'][type]['views'][index]} //
                  conflictA={conflictA}
                  conflictB={conflictB}
                  chosenvalues={chosenvalues}
                  isclickLeft={isclickLeft}
                  isclickRight={isclickRight}
                  styletypeLeft={styletypeLeft}
                  styletypeMiddle={styletypeMiddle}
                  styletypeRight={styletypeRight}
                  setFieldChanged={setFieldChanged}
                  revisionlist={revisionlist}
                  inirevision={conflicts['initial_head']}
                  onButtonSave={onButtonSave}
                />
              </div>
            </TabPanel>
          ))}
      </TabContext>
    </Grid>
  );
}
