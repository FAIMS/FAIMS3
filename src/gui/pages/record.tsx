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
  Button,
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
import {isSyncingProjectAttachments} from '../../sync/sync-toggle';
import {
  InitialMergeDetails,
  getInitialMergeDetails,
  findConflictingFields,
} from '../../data_storage/merging';
import Alert from '@mui/material/Alert';
import {
  ConflictHelpDialog,
  BasicDiaglog,
} from '../components/record/conflict/conflictDialog';
import {EditDroplist} from '../components/record/conflict/conflictdroplist';
import Badge from '@mui/material/Badge';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {ResolveButton} from '../components/record/conflict/conflictbutton';
import useMediaQuery from '@mui/material/useMediaQuery';
import {useTheme} from '@mui/material/styles';

const useStyles = makeStyles(theme => ({
  NoPaddding: {
    [theme.breakpoints.down('md')]: {
      paddingLeft: 2,
      paddingRight: 2,
    },
    paddingLeft: 5,
    paddingRight: 5,
  },
  LeftPaddding: {
    [theme.breakpoints.down('md')]: {
      paddingLeft: 10,
      paddingRight: 10,
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
  const [updatedrevision_id, setrevision_id] = React.useState(revision_id);
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
  const [isSyncing, setIsSyncing] = useState<null | boolean>(null); // this is to check if the project attachment sync
  const [conflicts, setConflicts] = useState(
    null as InitialMergeDetails | null
  );
  const [selectrevision, setselectedRevision] = useState(null as null | string); // set default one as revision_id and if there is conflict then get the new vision of content
  const [issavedconflict, setissavedconflict] = useState(record_id); // this is to check if the conflict resolved been saved
  const [conflictfields, setConflictfields] = useState(null as null | string[]);
  const [isalerting, setIsalerting] = useState(true); // this is to check if user get notified in conflict record
  const [recrodinfo, setRecordinfo] = useState(null as null | string); // add Updated time and User for Record form
  const theme = useTheme();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));
  const [open, setOpen] = React.useState(false);
  const [pressedvalue, setpressedvalue] = useState(value);

  const breadcrumbs = [
    {link: ROUTES.HOME, title: 'Home'},
    {link: ROUTES.PROJECT_LIST, title: 'Notebooks'},
    {
      link: ROUTES.PROJECT + project_id,
      title: project_info !== null ? project_info.name : project_id,
    },
    {title: hrid ?? record_id},
    // {title: recrodinfo},
  ];

  useEffect(() => {
    getUiSpecForProject(project_id).then(setUISpec, setError);
    if (project_id !== null) {
      getProjectMetadata(project_id, 'sections').then(res =>
        setMetaSection(res)
      );
      setIsSyncing(isSyncingProjectAttachments(project_id));
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
        if (result !== null && result['available_heads'] !== undefined) {
          setrevision_id(result['initial_head']); //reset revision id after conflict
          if (Object.keys(result['available_heads']).length > 1)
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
        updatedrevision_id
      );
      if (latest_record !== null) {
        setType(latest_record.type);
        setRecordinfo(
          JSON.stringify(latest_record.updated)
            .replaceAll('"', '')
            .replaceAll('T', ' ')
            .slice(0, 19) +
            ' ' +
            latest_record.updated_by
        );
      }
    };
    getType();
  }, [project_id, record_id, updatedrevision_id]);

  const handleChange = (event: React.ChangeEvent<{}>, newValue: string) => {
    if (
      value === '4' &&
      conflicts !== null &&
      conflicts['available_heads'] !== undefined &&
      Object.keys(conflicts['available_heads']).length > 1
    ) {
      setOpen(true);
      setpressedvalue(newValue);
    } else setValue(newValue);
  };

  const handleConfirm = () => {
    setValue(pressedvalue);
    setOpen(false);
  };

  const setRevision = async (revision: string) => {
    setselectedRevision(revision);
  };

  if (uiSpec === null || type === null || hrid === null || conflicts === null)
    return <CircularProgress size={12} thickness={4} />;
  return (
    <Container maxWidth="lg" className={classes.NoPaddding}>
      <Breadcrumbs data={breadcrumbs} token={props.token} />
      {recrodinfo !== null && (
        <Box justifyContent="flex-end" alignItems="flex-end" display="flex">
          <Typography variant={'caption'} gutterBottom>
            Last Updated {recrodinfo}
          </Typography>
        </Box>
      )}
      <Box mb={2} className={classes.LeftPaddding} pr={1}>
        <Typography variant={'h2'} component={'h1'}>
          {uiSpec !== null && type !== null && uiSpec['visible_types'][0] !== ''
            ? '' + uiSpec.viewsets[type]['label'] + ' Record ' + hrid
            : ''}{' '}
          {draft_id !== undefined && ' Draft '}
        </Typography>
        <Typography variant={'subtitle1'} gutterBottom>
          Edit data for this record. If you need to, you can also revisit
          previous revisions and resolve conflicts.
        </Typography>
        {conflicts !== null &&
          conflicts['available_heads'] !== undefined &&
          Object.keys(conflicts['available_heads']).length > 1 && (
            <Box bgcolor={'#fff3e0'}>
              <Grid container>
                <Grid sm={6} xs={12} md={6}>
                  <Alert severity="warning" icon={<InfoOutlinedIcon />}>
                    This record has{' '}
                    {Object.keys(conflicts['available_heads']).length}{' '}
                    conflicting instances. Resolve these conflicts before
                    continuing
                  </Alert>
                </Grid>

                <Grid sm={6} xs={12} md={6}>
                  <Alert
                    severity="warning"
                    action={<ConflictHelpDialog type={'info'} />}
                    icon={<></>}
                  ></Alert>
                </Grid>
              </Grid>
            </Box>
          )}
      </Box>
      <Paper square className={classes.NoPaddding}>
        <TabContext value={value}>
          <AppBar position="static" color="primary">
            <TabList
              onChange={handleChange}
              aria-label="Record Form Tab"
              indicatorColor={'secondary'}
              textColor="secondary"
              centered={not_xs ? false : true}
            >
              <Tab
                label="Edit"
                value="1"
                style={{
                  color: '#c2c2c2',
                  width: '70px',
                }}
              />
              <Tab
                label="Revisions"
                value="2"
                style={{color: '#c2c2c2', maxWidth: '70px'}}
              />
              <Tab
                label="Meta"
                value="3"
                style={{color: '#c2c2c2', maxWidth: '70px'}}
              />
              {conflicts !== null &&
              conflicts['available_heads'] !== undefined &&
              Object.keys(conflicts['available_heads']).length > 1 ? (
                <Tab
                  label={
                    <Badge
                      badgeContent={
                        Object.keys(conflicts['available_heads']).length
                      }
                      color="error"
                    >
                      {'Conflicts  '}
                      {'\xa0\xa0'}
                    </Badge>
                  }
                  value="4"
                  style={{color: '#c2c2c2'}}
                />
              ) : (
                <Tab
                  label="Conflicts"
                  value="4"
                  style={{color: '#c2c2c2', maxWidth: '80px'}}
                />
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
              } else if (
                uiSpec === null ||
                type === null ||
                isSyncing === null
              ) {
                // Loading
                return <CircularProgress size={12} thickness={4} />;
              } else {
                return (
                  <Box pl={0}>
                    {conflicts !== null &&
                    conflicts['available_heads'] !== undefined &&
                    Object.keys(conflicts['available_heads']).length > 1 ? (
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
                              {draft_id !== undefined ? (
                                <Typography>
                                  <strong>Current Edit Revision:</strong> <br />
                                  {updatedrevision_id}
                                </Typography>
                              ) : (
                                <EditDroplist
                                  label={'edit'}
                                  headerlist={conflicts['available_heads']}
                                  revision={selectrevision ?? ''}
                                  index={0}
                                  setRevision={setRevision}
                                  disablerevision={''}
                                  isalerting={isalerting}
                                />
                              )}
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
                                prevent creating further versions of this
                                record.{' '}
                                <Typography>
                                  <ResolveButton handleChange={handleChange} />
                                  {isalerting && draft_id === undefined && (
                                    <>
                                      Or select version and {'  '}
                                      <Button
                                        variant="text"
                                        style={{
                                          color: '#f29c3e',
                                          paddingLeft: 0,
                                        }}
                                        onClick={() => setIsalerting(false)}
                                      >
                                        {'  '}Edit anyway
                                      </Button>
                                    </>
                                  )}
                                </Typography>
                              </Alert>
                            </Grid>
                          </Grid>
                        </Box>
                        <Box px={not_xs ? 30 : 0}>
                          {(isalerting === false || draft_id !== undefined) && (
                            <RecordForm
                              project_id={project_id}
                              record_id={record_id}
                              revision_id={
                                selectrevision !== null
                                  ? selectrevision
                                  : updatedrevision_id
                              }
                              ui_specification={uiSpec}
                              draft_id={draft_id}
                              metaSection={metaSection}
                              conflictfields={conflictfields}
                              handleChangeTab={handleChange}
                              isSyncing={isSyncing.toString()}
                            />
                          )}
                        </Box>
                      </Box>
                    ) : (
                      <RecordForm
                        project_id={project_id}
                        record_id={record_id}
                        revision_id={updatedrevision_id}
                        ui_specification={uiSpec}
                        draft_id={draft_id}
                        metaSection={metaSection}
                        isSyncing={isSyncing.toString()}
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
              revision_id={updatedrevision_id}
            />
            <Box mt={2}>
              <RecordDelete
                project_id={project_id}
                record_id={record_id}
                revision_id={updatedrevision_id}
              />
            </Box>
          </TabPanel>
          <TabPanel value="4" style={{overflowX: 'auto'}}>
            <Box mt={2}>
              <BasicDiaglog
                handleClose={() => setOpen(false)}
                handleOpen={() => setOpen(true)}
                handleConfirm={handleConfirm}
                content={`This record has
                ${Object.keys(conflicts['available_heads']).length} 
                conflicting instances. Resolve these conflicts before
                continuing`}
                continue={'continue'}
                cancel={'Resolve'}
                open={open}
              />
              {isSyncing !== null && (
                <ConflictForm
                  project_id={project_id}
                  record_id={record_id}
                  revision_id={updatedrevision_id}
                  ui_specification={uiSpec}
                  metaSection={metaSection}
                  type={type}
                  conflicts={conflicts}
                  setissavedconflict={setissavedconflict}
                  isSyncing={isSyncing.toString()}
                  not_xs={not_xs}
                />
              )}
            </Box>
          </TabPanel>
        </TabContext>
      </Paper>
    </Container>
  );
}
