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
 * Filename: record.tsx
 * Description:
 *   TODO
 */

import React, {useContext, useEffect, useState} from 'react';
import {useHistory, useParams, Redirect} from 'react-router-dom';

import {
  AppBar,
  Box,
  Grid,
  Container,
  Typography,
  Paper,
  Tab,
  CircularProgress,
} from '@mui/material';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import {ActionType} from '../../actions';

import * as ROUTES from '../../constants/routes';
import {getProjectInfo, listenProjectInfo} from '../../databaseAccess';
import {ProjectID, RecordID, RevisionID} from '../../datamodel/core';
import {
  ProjectUIModel,
  ProjectInformation,
  SectionMeta,
} from '../../datamodel/ui';
import {listFAIMSRecordRevisions} from '../../data_storage';
import {store} from '../../store';
import {getUiSpecForProject} from '../../uiSpecification';
import RecordForm from '../components/record/form';
import ConflictForm from '../components/record/conflict/conflictform';
import RecordMeta from '../components/record/meta';
import RecordDelete from '../components/record/delete';
import BoxTab from '../components/ui/boxTab';
import Breadcrumbs from '../components/ui/breadcrumbs';
import {useEventedPromise, constantArgsShared} from '../pouchHook';
import makeStyles from '@mui/styles/makeStyles';
import {getProjectMetadata} from '../../projectMetadata';
import {TokenContents} from '../../datamodel/core';
import {grey} from '@mui/material/colors';
import {getFullRecordData, getHRIDforRecordID} from '../../data_storage';
import {
  InitialMergeDetails,
  getInitialMergeDetails,
  findConflictingFields,
} from '../../data_storage/merging';
import Alert from '@mui/material/Alert';
import {ConflictHelpDialog} from '../components/record/conflict/conflictDialog';
import {EditDroplist} from '../components/record/conflict/conflictdroplist';
import Badge from '@mui/material/Badge';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {ResolveButton} from '../components/record/conflict/conflictbutton';
const useStyles = makeStyles(theme => ({
  NoPaddding: {
    [theme.breakpoints.down('md')]: {
      paddingLeft: 0,
      paddingRight: 0,
    },
    paddingLeft: 0,
    paddingRight: 1,
  },
  LeftPaddding: {
    [theme.breakpoints.down('md')]: {
      paddingLeft: 10,
    },
  },
}));

type RecordeProps = {
  token?: null | undefined | TokenContents;
};

export default function Record(props: RecordeProps) {
  const {project_id, record_id, revision_id, draft_id} = useParams<{
    project_id: ProjectID;
    record_id: RecordID;
    revision_id: RevisionID;
    draft_id?: string;
  }>();
  const {dispatch} = useContext(store);
  const history = useHistory();

  const [value, setValue] = React.useState('1');

  let project_info: ProjectInformation | null;
  try {
    project_info = useEventedPromise(
      getProjectInfo,
      constantArgsShared(listenProjectInfo, project_id),
      false,
      [project_id],
      project_id
    ).expect();
  } catch (err: any) {
    if (err.message !== 'missing') {
      throw err;
    } else {
      return <Redirect to="/404" />;
    }
  }

  const [uiSpec, setUISpec] = useState(null as null | ProjectUIModel);
  const [revisions, setRevisions] = React.useState([] as string[]);
  const [error, setError] = useState(null as null | {});
  const classes = useStyles();
  const [metaSection, setMetaSection] = useState(null as null | SectionMeta);
  const [type, setType] = useState(null as null | string);
  const [hrid, setHrid] = useState(null as null | string);
  const [conflicts, setConflicts] = useState(
    null as InitialMergeDetails | null
  );
  const [selectrevision, setselectedRevision] = useState(null as null | string); // set default one as revision_id and if there is confilct then get the new vision of content
  const [issavedconflict, setissavedconflict] = useState(record_id); // this is to check if the conflict resolved been saved
  const [conflictfields, setConflictfields] = useState(null as null | string[]);

  const breadcrumbs = [
    {link: ROUTES.HOME, title: 'Home'},
    {link: ROUTES.PROJECT_LIST, title: 'Notebooks'},
    {
      link: ROUTES.PROJECT + project_id,
      title: project_info !== null ? project_info.name : project_id,
    },
    {title: hrid ?? record_id},
    // {title: revision_id},
  ];

  useEffect(() => {
    getUiSpecForProject(project_id).then(setUISpec, setError);
    if (project_id !== null) {
      getProjectMetadata(project_id, 'sections').then(res =>
        setMetaSection(res)
      );
    }
  }, [project_id]);

  useEffect(() => {
    const getIni = async () => {
      setRevisions([]);
      listFAIMSRecordRevisions(project_id, record_id)
        .then(all_revisions => {
          setRevisions(all_revisions);
        })
        .catch(console.error /*TODO*/);
      getHRIDforRecordID(project_id, record_id).then(hrid => setHrid(hrid));
    };

    getIni();
  }, [project_id, record_id]);

  // below function is to get conflicts headers when loading record or after user save the conflict resolve button
  useEffect(() => {
    const getconflicts = async () => {
      getInitialMergeDetails(project_id, record_id).then(result => {
        setConflicts(result);
        if (
          result !== null &&
          result['available_heads'] !== undefined &&
          result['available_heads'].length > 1
        ) {
          setselectedRevision(result['initial_head']); // reset the revision number if there is conflict
        }
      });
    };

    getconflicts();
  }, [project_id, record_id, issavedconflict]);

  useEffect(() => {
    const getConflictList = async () => {
      if (selectrevision !== null)
        setConflictfields(
          await findConflictingFields(project_id, record_id, selectrevision)
        );
    };
    getConflictList();
  }, [selectrevision]);

  useEffect(() => {
    const getType = async () => {
      const latest_record = await getFullRecordData(
        project_id,
        record_id,
        revision_id
      );
      if (latest_record !== null) setType(latest_record.type);
    };
    getType();
  }, [project_id, record_id, revision_id]);

  const handleChange = (event: React.ChangeEvent<{}>, newValue: string) => {
    setValue(newValue);
  };

  const setRevision = async (revision: string) => {
    setselectedRevision(revision);
  };

  if (uiSpec === null || type === null || hrid === null || conflicts === null)
    return <CircularProgress size={12} thickness={4} />;
  return (
    <Container maxWidth="lg" className={classes.NoPaddding}>
      <Breadcrumbs data={breadcrumbs} token={props.token} />
      <Box mb={2} className={classes.LeftPaddding}>
        <Typography variant={'h2'} component={'h1'}>
          {uiSpec !== null && type !== null && uiSpec['visible_types'][0] !== ''
            ? '' + uiSpec.viewsets[type]['label'] + ' Record ' + hrid
            : ''}{' '}
        </Typography>
        <Typography variant={'subtitle1'} gutterBottom>
          Edit data for this record. If you need to, you can also revisit
          previous revisions and resolve conflicts.
        </Typography>
        {conflicts !== null &&
          conflicts['available_heads'] !== undefined &&
          conflicts['available_heads'].length > 1 && (
            <Alert
              severity="warning"
              action={<ConflictHelpDialog type={'info'} />}
              icon={<InfoOutlinedIcon />}
            >
              This Record has {conflicts['available_heads'].length} conflicting
              instances. Resolve these conflicts before continue
            </Alert>
          )}
      </Box>
      <Paper square className={classes.NoPaddding}>
        <TabContext value={value}>
          <AppBar position="static" color="primary">
            <TabList
              onChange={handleChange}
              aria-label="simple tabs example"
              indicatorColor={'secondary'}
              textColor="secondary"
            >
              <Tab label="Edit" value="1" sx={{color: '#c2c2c2'}} />
              <Tab label="Revisions" value="2" sx={{color: '#c2c2c2'}} />
              <Tab label="Meta" value="3" sx={{color: '#c2c2c2'}} />
              {conflicts !== null &&
              conflicts['available_heads'] !== undefined &&
              conflicts['available_heads'].length > 1 ? (
                <Tab
                  label={
                    <Badge
                      badgeContent={conflicts['available_heads'].length}
                      color="error"
                    >
                      {'Conflicts  '}
                      {'\xa0\xa0'}
                    </Badge>
                  }
                  value="4"
                  sx={{color: '#c2c2c2'}}
                />
              ) : (
                <Tab label="Conflicts" value="4" sx={{color: '#c2c2c2'}} />
              )}
            </TabList>
          </AppBar>
          <TabPanel value="1" style={{paddingLeft: 0, paddingRight: 0}}>
            {(() => {
              if (error !== null) {
                dispatch({
                  type: ActionType.ADD_ALERT,
                  payload: {
                    message: 'Could not load form: ' + error.toString(),
                    severity: 'warning',
                  },
                });
                history.goBack();
                return <React.Fragment />;
              } else if (uiSpec === null || type === null) {
                // Loading
                return <CircularProgress size={12} thickness={4} />;
              } else {
                return (
                  <Box pl={0}>
                    {conflicts !== null &&
                    conflicts['available_heads'] !== undefined &&
                    conflicts['available_heads'].length > 1 ? (
                      <Box pl={0}>
                        <Box bgcolor={grey[200]} py={10} pl={0}>
                          <Grid
                            container
                            justifyContent="flex-start"
                            alignItems="center"
                          >
                            <Grid
                              item
                              md={5}
                              xs={12}
                              container
                              justifyContent="center"
                              alignItems="center"
                            >
                              <EditDroplist
                                label={'eidt'}
                                headerlist={conflicts['available_heads']}
                                revision={selectrevision ?? ''}
                                index={0}
                                setRevision={setRevision}
                                disablerevision={''}
                              />
                            </Grid>
                            <Grid
                              item
                              md={7}
                              xs={12}
                              container
                              justifyContent="center"
                              alignItems="center"
                            >
                              <Alert
                                severity="warning"
                                icon={<InfoOutlinedIcon />}
                              >
                                Edits have been made to this record by different
                                users that cannot be automatically mergeed.
                                Resolve the conflicting fields before editing to
                                prevent creating futhrer versions of this
                                record.{' '}
                                <ResolveButton handleChange={handleChange} />
                              </Alert>
                            </Grid>
                          </Grid>
                        </Box>
                        <RecordForm
                          project_id={project_id}
                          record_id={record_id}
                          revision_id={
                            selectrevision !== null
                              ? selectrevision
                              : revision_id
                          }
                          ui_specification={uiSpec}
                          draft_id={draft_id}
                          metaSection={metaSection}
                          conflictfields={conflictfields}
                          handleChangeTab={handleChange}
                        />
                      </Box>
                    ) : (
                      <RecordForm
                        project_id={project_id}
                        record_id={record_id}
                        revision_id={revision_id}
                        ui_specification={uiSpec}
                        draft_id={draft_id}
                        metaSection={metaSection}
                      />
                    )}
                  </Box>
                );
              }
            })()}
          </TabPanel>
          <TabPanel value="2">
            <Box p={2} />
            <BoxTab title={'record revisions'} />
            <Box
              bgcolor={grey[200]}
              pl={2}
              pr={2}
              style={{overflowX: 'scroll'}}
            >
              <pre>{JSON.stringify(revisions, null, 2)}</pre>
            </Box>
          </TabPanel>
          <TabPanel value="3">
            <RecordMeta
              project_id={project_id}
              record_id={record_id}
              revision_id={revision_id}
            />
            <Box mt={2}>
              <RecordDelete
                project_id={project_id}
                record_id={record_id}
                revision_id={revision_id}
              />
            </Box>
          </TabPanel>
          <TabPanel value="4" style={{overflowX: 'auto'}}>
            <Box mt={2}>
              <ConflictForm
                project_id={project_id}
                record_id={record_id}
                revision_id={revision_id}
                ui_specification={uiSpec}
                metaSection={metaSection}
                type={type}
                conflicts={conflicts}
                setissavedconflict={setissavedconflict}
              />
            </Box>
          </TabPanel>
        </TabContext>
      </Paper>
    </Container>
  );
}
