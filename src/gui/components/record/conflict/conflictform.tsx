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
import {
  ProjectUIModel,
  RecordMergeInformation,
  UserMergeResult,
} from '../../../../datamodel/ui';
import TabContext from '@mui/lab/TabContext';
import TabPanel from '@mui/lab/TabPanel';
import RecordTabBar from './recordTab';
import {
  InitialMergeDetails,
  getMergeInformationForHead,
} from '../../../../data_storage/merging';
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
type updatedType = {conflictfields: Array<string>; colourstyle: iscolourList};

function comparegetconflictField(
  conflictA: RecordMergeInformation,
  conflictB: RecordMergeInformation,
  fieldslist: Array<string>,
  ismcolour: iscolourList
): updatedType {
  const conflictfields: Array<string> = [];
  fieldslist.map(field => {
    if (
      conflictA['fields'][field]['avp_id'] !==
      conflictB['fields'][field]['avp_id']
    )
      conflictfields.push(field);
    else ismcolour[field] = 'clear';
  });
  return {conflictfields: conflictfields, colourstyle: ismcolour};
}

export default function ConflictForm(props: ConflictFormProps) {
  const {ui_specification, project_id, record_id, type, conflicts} = props;
  //this are tabs for form sections
  const [tabvalue, setValue] = useState('0');
  const handleChange = (event: React.ChangeEvent<{}>, newValue: string) => {
    setValue(newValue);
  };
  //below are the header data of three columns
  const [conflictA, setConflictA] = useState(conflicts['initial_head_data']);
  const [conflictB, setConflictB] = useState(
    null as RecordMergeInformation | null
  );
  const fieldslist: Array<string> = [];
  const initialvalues: RecordMergeInformation = {
    ...conflicts['initial_head_data'],
    fields: {},
  };
  ui_specification['viewsets'][type]['views'].map((view: string) =>
    ui_specification['views'][view]['fields'].map((field: string) => {
      fieldslist.push(field);
      initialvalues['fields'][field] = {
        ...conflicts['initial_head_data']['fields'][field],
      };
    })
  );
  const [chosenvalues, setChoosenvalues] = useState(initialvalues);
  //this the header data of middle column, which is the choosen one
  //above are the header data of three columns
  // to get all fields of the form

  //below are the style of icons to choose reject or tick
  const isclick: isclicklist = {};
  fieldslist.map(field => (isclick[field] = false));
  const [isclickLeft, setIsClickLeft] = useState(isclick);
  const [isclickRight, setIsClickRight] = useState(isclick);
  //above are the style of icons to choose reject or tick
  //below are the style of 3 columns of forms , including color inditor on the top, icons
  const iscolour: iscolourList = {};
  fieldslist.map(field => (iscolour[field] = 'default'));
  const [styletypeLeft, setstyletypeLeft] = useState(iscolour);
  const [styletypeRight, setstyletypeRight] = useState(iscolour);
  const ismcolour: iscolourList = {};
  fieldslist.map(field => (ismcolour[field] = 'warning'));
  //above are the style of 3 columns of forms , including color inditor on the top, icons
  const [styletypeMiddle, setstyletypeMiddle] = useState(ismcolour);
  const [revisionlist, setRevisionList] = useState([
    conflicts['initial_head'],
    '',
  ]); // 2 compared revision list(revision A and revision B )
  const [comparedrevision, setR] = useState(''); // this is just a value to trigger the revsion changed
  const [isloading, setIsloading] = useState(true); //when 2 conflict revision been load, value will be set to false
  const [conflictfields, setconflictfields] = useState<Array<string>>([]); //get list of comnflict fields for the 2 revisions
  const [istoggleAll, setIstoggleAll] = useState(false); // toggle to show all Field of Form or just conflict fields

  const updateconflict = (
    setconflict: any,
    revisionvalue: string,
    compareconflict: RecordMergeInformation | null
  ) => {
    let updated: updatedType;
    if (revisionvalue !== '') {
      setconflict(null);
      setIsloading(true);
      getMergeInformationForHead(project_id, record_id, revisionvalue).then(
        result => {
          setconflict(result);
          //reset the color and click for the buttons and cards
          setstyletypeMiddle({...ismcolour});
          setstyletypeLeft({...iscolour});
          setstyletypeRight({...iscolour});
          setIsClickLeft({...isclick});
          setIsClickRight({...isclick});
          setChoosenvalues({...initialvalues});
          if (result !== null && compareconflict !== null) {
            updated = comparegetconflictField(
              result,
              compareconflict,
              fieldslist,
              ismcolour
            );
            setconflictfields(updated.conflictfields);
            setstyletypeMiddle(updated.colourstyle);
          }
          setIsloading(false);
          console.log(
            '+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++'
          );
          console.log(result);
        }
      );
    }
  };

  useEffect(() => {
    const getConflict = async () => {
      if (comparedrevision === null || comparedrevision === '') return;
      if (comparedrevision.charAt(0) === '1') {
        return updateconflict(setConflictB, revisionlist[1], conflictA);
      }
      if (comparedrevision.charAt(0) === '0') {
        return updateconflict(setConflictA, revisionlist[0], conflictB);
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
    if (conflictA === null || conflictB === null) return;
    if (sleft !== null)
      setstyletypeLeft({...styletypeLeft, [fieldName]: sleft});
    if (smiddle !== null)
      setstyletypeMiddle({...styletypeMiddle, [fieldName]: smiddle});
    if (sright !== null)
      setstyletypeRight({...styletypeRight, [fieldName]: sright});
    if (left) {
      setIsClickLeft({...isclickLeft, [fieldName]: true});
      if (choosevalueA !== null)
        setIsClickRight({...isclickRight, [fieldName]: true});
    } else {
      setIsClickRight({...isclickRight, [fieldName]: true});
      if (choosevalueA !== null)
        setIsClickLeft({...isclickLeft, [fieldName]: true});
    }
    if (chosenvalues !== null) {
      const newvalues = chosenvalues['fields'][fieldName];
      if (choosevalueA === true && conflicts !== null && newvalues !== null) {
        newvalues['data'] = conflictA['fields'][fieldName]['data'];
        newvalues['avp_id'] = conflictA['fields'][fieldName]['avp_id'];
      } else if (
        choosevalueA === false &&
        conflicts !== null &&
        newvalues !== null
      ) {
        if (conflictB !== null) {
          newvalues['data'] = conflictB['fields'][fieldName]['data'];
          newvalues['avp_id'] = conflictB['fields'][fieldName]['avp_id'];
        }
      } else if (
        choosevalueA === null &&
        left &&
        isclickRight[fieldName] === true
      ) {
        setstyletypeMiddle({...styletypeMiddle, [fieldName]: 'delete'});
        // newvalues['data'] = null;
        newvalues['avp_id'] = '';
      } else if (
        choosevalueA === null &&
        left === false &&
        isclickLeft[fieldName] === true
      ) {
        setstyletypeMiddle({...styletypeMiddle, [fieldName]: 'delete'});
        // newvalues['data'] = null;
        newvalues['avp_id'] = '';
      }
      setChoosenvalues({
        ...chosenvalues,
        fields: {...chosenvalues.fields, [fieldName]: newvalues},
      });
      console.log(
        '+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++'
      );
      console.log(chosenvalues['fields'][fieldName]);
      console.log(conflictA['fields'][fieldName]);
    }
  };

  const setChooseAll = (value: string) => {
    const newleft: iscolourList = {};
    const newright: iscolourList = {};
    const newmiddle: iscolourList = {};
    const newclick = isclick;

    if (value === 'A') {
      fieldslist.map(fieldName => {
        if (conflictfields.includes(fieldName)) {
          newleft[fieldName] = 'success';
          newmiddle[fieldName] = 'success';
          newright[fieldName] = 'reject';
          newclick[fieldName] = true;
        } else {
          newleft[fieldName] = styletypeLeft[fieldName];
          newright[fieldName] = styletypeRight[fieldName];
          newmiddle[fieldName] = styletypeMiddle[fieldName];
        }
      });
      setstyletypeLeft({...newleft});
      setstyletypeMiddle({...newmiddle});
      setstyletypeRight({...newright});
      setIsClickLeft({...newclick});
      setIsClickRight({...newclick});
      const values: RecordMergeInformation = {
        ...conflictA,
        fields: {},
      };
      fieldslist.map(
        field =>
          (values['fields'][field] = {
            ...conflictA['fields'][field],
          })
      );
      setChoosenvalues({...values});
    } else if (value === 'B') {
      fieldslist.map(fieldName => {
        if (conflictfields.includes(fieldName)) {
          newleft[fieldName] = 'reject';
          newright[fieldName] = 'success';
          newmiddle[fieldName] = 'success';
          newclick[fieldName] = true;
        } else {
          newleft[fieldName] = styletypeLeft[fieldName];
          newright[fieldName] = styletypeRight[fieldName];
          newmiddle[fieldName] = styletypeMiddle[fieldName];
        }
      });
      setstyletypeLeft({...newleft});
      setstyletypeRight({...newright});
      setstyletypeMiddle({...newmiddle});
      setIsClickLeft({...newclick});
      setIsClickRight({...newclick});
      if (conflictB !== null) {
        const values: RecordMergeInformation = {
          ...conflictB,
          fields: {},
        };
        fieldslist.map(
          field =>
            (values['fields'][field] = {
              ...conflictB['fields'][field],
            })
        );
        setChoosenvalues({...values});
      }
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
    <Grid style={{minWidth: '800px', overflowX: 'auto'}}>
      <ConflictToolBar
        headerlist={conflicts['available_heads']}
        revisionlist={revisionlist}
        setRevisionList={setRevisionList}
        setR={setR}
        setChooseAll={setChooseAll}
        isloading={isloading}
        istoggleAll={istoggleAll}
        setIstoggleAll={setIstoggleAll}
      />
      <TabContext value={tabvalue}>
        <RecordTabBar
          handleChange={handleChange}
          ui_specification={ui_specification}
          type={type}
          conflictfields={conflictfields}
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
                  fieldslist={fieldslist}
                  conflictfields={conflictfields}
                  istoggleAll={istoggleAll}
                />
              </div>
            </TabPanel>
          ))}
      </TabContext>
    </Grid>
  );
}
