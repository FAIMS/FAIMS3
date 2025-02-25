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

import {
  InitialMergeDetails,
  ProjectID,
  ProjectInformation,
  ProjectUIModel,
  RecordID,
  Relationship,
  RevisionID,
  findConflictingFields,
  getFullRecordData,
  getHRIDforRecordID,
  getInitialMergeDetails,
  listFAIMSRecordRevisions,
} from '@faims3/data-model';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import {
  Alert,
  AppBar,
  Box,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Tab,
  Typography,
} from '@mui/material';
import Badge from '@mui/material/Badge';
import {grey} from '@mui/material/colors';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import React, {useEffect, useRef, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {NOTEBOOK_NAME_CAPITALIZED} from '../../buildconfig';
import * as ROUTES from '../../constants/routes';
import {addAlert} from '../../context/slices/syncSlice';
import {useAppDispatch} from '../../context/store';
import {logError} from '../../logging';
import {getProjectInfo} from '../../sync/projects';
import {isSyncingProjectAttachments} from '../../sync/sync-toggle';
import {getUiSpecForProject} from '../../uiSpecification';
import RecordDelete from '../components/notebook/delete';
import ProgressBar from '../components/progress-bar';
import {ResolveButton} from '../components/record/conflict/conflictbutton';
import {
  BasicDialog,
  ConflictHelpDialog,
} from '../components/record/conflict/conflictDialog';
import {EditDroplist} from '../components/record/conflict/conflictdroplist';
import ConflictForm from '../components/record/conflict/conflictform';
import RecordMeta from '../components/record/meta';
import RecordData from '../components/record/RecordData';
import {
  getDetailRelatedInformation,
  getParentPersistenceData,
  remove_deleted_parent,
} from '../components/record/relationships/RelatedInformation';
import {
  ParentLinkProps,
  RecordLinkProps,
} from '../components/record/relationships/types';
import BackButton from '../components/ui/BackButton';
import BoxTab from '../components/ui/boxTab';
import CircularLoading from '../components/ui/circular_loading';
import getLocalDate from '../fields/LocalDate';

export default function Record() {
  /**
   * Record Page. Comprises multiple tab components;
   * View - displays child records and a read-only view of the record.
   * Edit
   * Revisions
   * Meta
   * Conflict
   */
  const {project_id, record_id, revision_id, draft_id} = useParams<{
    project_id: ProjectID;
    record_id: RecordID;
    revision_id: RevisionID;
    draft_id?: string;
  }>();
  const [updatedrevision_id, setrevision_id] = React.useState(revision_id);

  const dispatch = useAppDispatch();
  const history = useNavigate();

  const [value, setValue] = React.useState('1');
  const [projectInfo, setProjectInfo] = useState<ProjectInformation | null>(
    null
  );
  useEffect(() => {
    if (project_id)
      getProjectInfo(project_id).then(info => setProjectInfo(info));
  }, [project_id]);

  const [uiSpec, setUISpec] = useState(null as null | ProjectUIModel);
  const [revisions, setRevisions] = React.useState([] as string[]);
  const [error, setError] = useState(null as null | {});
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [draftLastSaved, setDraftLastSaved] = useState(null as Date | null);
  const [draftError, setDraftError] = useState(null as string | null);
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
  const [recordInfo, setRecordinfo] = useState(null as null | string); // add Updated time and User for Record form
  const theme = useTheme();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));
  const mq_above_md = useMediaQuery(theme.breakpoints.up('md'));
  const [open, setOpen] = React.useState(false);
  const [pressedvalue, setpressedvalue] = useState(value);
  const [relatedRecords, setRelatedRecords] = useState([] as RecordLinkProps[]);
  const [parentLinks, setParentLinks] = useState([] as ParentLinkProps[]);
  const [is_link_ready, setIs_link_ready] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setBreadcrumbs] = useState<{link?: string; title: string}[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const buttonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    getUiSpecForProject(project_id!).then(setUISpec, setError);
    if (project_id !== null) {
      try {
        setIsSyncing(isSyncingProjectAttachments(project_id!));
      } catch (error) {
        logError(error);
      }
    }
  }, [project_id]);

  useEffect(() => {
    const getIni = async () => {
      setIs_link_ready(false); //reset the link ready when record id changed
      setRevisions([]);
      listFAIMSRecordRevisions(project_id!, record_id!)
        .then(all_revisions => {
          setRevisions(all_revisions);
        })
        .catch(logError);
      getHRIDforRecordID(project_id!, record_id!).then(hrid => {
        setHrid(hrid);
        setBreadcrumbs([
          // {link: ROUTES.INDEX, title: 'Home'},
          {
            link: ROUTES.NOTEBOOK_LIST_ROUTE,
            title: `${NOTEBOOK_NAME_CAPITALIZED}s`,
          },
          {
            link: ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE + project_id,
            title: projectInfo !== null ? projectInfo.name! : project_id!,
          },
          {title: hrid ?? record_id},
        ]);
        setrevision_id(revision_id);
        setselectedRevision(revision_id!);
        setValue('1');
      });
    };

    getIni();
  }, [project_id, record_id]);

  // below function is to get conflicts headers when loading record or after user save the conflict resolve button
  useEffect(() => {
    const getconflicts = async () => {
      getInitialMergeDetails(project_id!, record_id!)
        .then(result => {
          setConflicts(result);
          if (result !== null && result['available_heads'] !== undefined) {
            setrevision_id(result['initial_head']); //reset revision id after conflict
            if (Object.keys(result['available_heads']).length > 1)
              setselectedRevision(result['initial_head']); // reset the revision number if there is conflict
          }
        })
        .catch(logError);
    };

    getconflicts();
  }, [project_id, record_id, issavedconflict]);

  useEffect(() => {
    const getConflictList = async () => {
      try {
        if (selectrevision !== null) {
          setrevision_id(selectrevision); //set revision_id what is in the form, so it can be same
          setConflictfields(
            await findConflictingFields(project_id!, record_id!, selectrevision)
          );
        }
      } catch (error) {
        logError(error);
      }
    };
    getConflictList();
  }, [selectrevision]);

  useEffect(() => {
    const getType = async () => {
      try {
        const latest_record = await getFullRecordData(
          project_id!,
          record_id!,
          updatedrevision_id!
        );

        if (latest_record !== null) {
          setType(latest_record.type);
          setRecordinfo(
            getLocalDate(latest_record.updated).replace('T', ' ') +
              ' ' +
              latest_record.updated_by
          );
        }
      } catch (error) {
        logError(error);
      }
    };
    getType();
  }, [project_id, record_id, updatedrevision_id]);

  useEffect(() => {
    // this is function to get child information
    const getrelated_Info = async () => {
      try {
        if (uiSpec !== null && type !== null) {
          const latest_record = await getFullRecordData(
            project_id!,
            record_id!,
            updatedrevision_id!,
            false
          );
          if (latest_record !== null) {
            //add checking for deleted record, so it can be direct to notebook page
            if (latest_record.deleted === true) {
              dispatch(
                addAlert({
                  message: 'Could not load record, it might be deleted ',
                  severity: 'warning',
                })
              );
              history({
                pathname: ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE + project_id,
              });
            }
            const newRelationship = await getDetailRelatedInformation(
              uiSpec,
              type,
              latest_record.data,
              project_id!,
              latest_record.relationship ?? null,
              record_id!,
              updatedrevision_id!
            );
            setRelatedRecords(newRelationship);
            const newParent = await getParentPersistenceData({
              uiSpecification: uiSpec,
              projectId: project_id!,
              parent: latest_record.relationship ?? null,
            });
            setParentLinks(newParent);
            let newBreadcrumbs = [
              // {link: ROUTES.INDEX, title: 'Home'},
              {
                link: ROUTES.NOTEBOOK_LIST_ROUTE,
                title: `${NOTEBOOK_NAME_CAPITALIZED}s`,
              },
              {
                link: ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE + project_id,
                title: projectInfo !== null ? projectInfo.name! : project_id!,
              },
              {title: hrid! ?? record_id!},
            ];
            if (
              newParent !== null &&
              newParent.length > 0 &&
              newParent[0].deleted !== true
            ) {
              newBreadcrumbs = [
                // {link: ROUTES.INDEX, title: 'Home'},
                {
                  link: ROUTES.NOTEBOOK_LIST_ROUTE,
                  title: `${NOTEBOOK_NAME_CAPITALIZED}s`,
                },
                {
                  link: ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE + project_id,
                  title: projectInfo !== null ? projectInfo.name! : project_id!,
                },
                {
                  link: newParent[0]['route'],
                  title: newParent[0]['hrid'],
                },
                {title: hrid! ?? record_id!},
              ];
            }
            setBreadcrumbs(newBreadcrumbs);
          }
          // setValue('1');
          setIs_link_ready(true);
        }
      } catch (error) {
        console.error(error);
        logError(error);
        //setIs_link_ready(true);
      }
    };
    getrelated_Info();
  }, [uiSpec, type, updatedrevision_id]);

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

  const handleUnlink = (
    parent_record_id: string,
    relation_type: string,
    field_id: string
  ) => {
    remove_deleted_parent(
      relation_type,
      project_id!,
      record_id!,
      updatedrevision_id,
      field_id,
      parent_record_id,
      relatedRecords
    ).then(
      (result: {
        is_updated: boolean;
        new_revision_id: string | null | undefined;
        new_relation: Relationship;
        newRelationship: RecordLinkProps[];
      }) => {
        if (result.is_updated) {
          if (
            result.new_revision_id !== undefined &&
            result.new_revision_id !== null &&
            result.new_revision_id !== ''
          )
            setrevision_id(result.new_revision_id);
          if (uiSpec !== null) {
            setRelatedRecords(result.newRelationship);

            getParentPersistenceData({
              uiSpecification: uiSpec,
              projectId: project_id!,
              parent: result.new_relation,
            }).then(newParent => {
              setParentLinks(newParent);
            });
          }
        } else {
          dispatch(
            addAlert({
              message: 'Could not remove link,please save and then try again ',
              severity: 'warning',
            })
          );
        }
      }
    );
  };

  const handleConfirm = () => {
    setValue(pressedvalue);
    setOpen(false);
  };

  const setRevision = async (revision: string) => {
    setselectedRevision(revision);
  };

  if (uiSpec === null || type === null || hrid === null || conflicts === null)
    return (
      <CircularProgress data-testid="progressbar" size={12} thickness={4} />
    );
  const record_type =
    uiSpec !== null && type !== null && uiSpec['visible_types'][0] !== ''
      ? '' + uiSpec.viewsets[type]['label']
      : '';

  const handleRefresh = () => {
    /**
     * Handler for Refreshing project (go back to notebook)
     */
    return new Promise(resolve => {
      resolve(() => {
        history({
          pathname: ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE + project_id,
        });
      });
    });
  };

  const titleLabel = (
    <React.Fragment>
      {uiSpec !== null && type !== null && uiSpec['visible_types'][0] !== ''
        ? '[' + uiSpec.viewsets[type]['label'] + '] ' + hrid
        : ''}{' '}
      {draft_id !== undefined && (
        <span
          style={{
            textDecorationLine: 'underline',
            textDecorationStyle: 'double',
          }}
        >
          [Draft]
        </span>
      )}
    </React.Fragment>
  );

  return (
    <Box>
      <Grid
        container
        wrap="nowrap"
        spacing={2}
        padding={theme.spacing(0.5)}
        alignItems="center"
      >
        <Grid item>
          <BackButton
            label="Back"
            onClick={() => {
              // Go back to the records list
              history({
                pathname: ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE + project_id,
              });
            }}
          />
        </Grid>
        <Grid item xs>
          <Typography
            variant={mq_above_md ? 'h3' : 'h4'}
            style={{overflowWrap: 'break-word'}}
          >
            {titleLabel}
          </Typography>
          {recordInfo !== null && (
            <Typography variant={'caption'} gutterBottom>
              Last Updated by {recordInfo}
            </Typography>
          )}
        </Grid>
      </Grid>
      <div style={{padding: '10px'}}>
        <ProgressBar percentage={progress} />
      </div>
      {/**
      <Grid item xs>
        {is_link_ready && <Breadcrumbs data={breadcrumbs} />}
      </Grid>
         */}
      {draft_id !== undefined && (
        <Alert severity={'warning'}>
          This record is currently a draft. The data is stored locally on your
          device only.
        </Alert>
      )}
      {/**
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <TransparentButton onClick={() => scrollToDiv(buttonRef)}>
          <ArrowDropDown />
          Jump to end
        </TransparentButton>
      </div>
       */}
      <Box mb={2} pr={1}>
        {conflicts !== null &&
          conflicts['available_heads'] !== undefined &&
          Object.keys(conflicts['available_heads']).length > 1 && (
            <Box bgcolor={'#fff3e0'}>
              <Grid container>
                <Grid sm={6} xs={12} md={6}>
                  <Alert severity="warning">
                    This record has{' '}
                    {Object.keys(conflicts['available_heads']).length}{' '}
                    conflicting instances. Resolve these conflicts before
                    continuing.
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
      <Paper square elevation={0} variant={'outlined'}>
        <TabContext value={value}>
          <AppBar
            position="static"
            sx={{
              backgroundColor: theme.palette.background.lightBackground,
              color: theme.palette.text.primary,
            }}
          >
            <TabList
              onChange={handleChange}
              aria-label="Record Form Tab"
              indicatorColor="secondary"
              TabIndicatorProps={{
                style: {
                  backgroundColor: theme.palette.secondary.contrastText,
                },
              }}
              textColor="inherit"
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab label="Data" value="1" />
              {
                //<Tab label="Revisions" value="2" />
              }
              <Tab label="Info" value="3" />
              {conflicts !== null &&
                conflicts['available_heads'] !== undefined &&
                Object.keys(conflicts['available_heads']).length > 1 && (
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
                  />
                )}
            </TabList>
          </AppBar>

          {(() => {
            if (error !== null) {
              dispatch(
                addAlert({
                  message: 'Could not load form: ' + error.toString(),
                  severity: 'warning',
                })
              );
              history(-1);
              return <React.Fragment />;
            } else if (uiSpec === null || type === null || isSyncing === null) {
              return (
                <Box sx={{p: 1}}>
                  <CircularLoading label={'Loading...'} />
                </Box>
              );
            } else {
              return (
                <React.Fragment>
                  <TabPanel value="1" sx={{p: 0}}>
                    <Box>
                      {conflicts !== null &&
                      conflicts['available_heads'] !== undefined &&
                      Object.keys(conflicts['available_heads']).length > 1 ? (
                        <Box>
                          <Box bgcolor={grey[100]} p={2}>
                            <Grid container spacing={1}>
                              <Grid item md={5} xs={12}>
                                {draft_id !== undefined ? (
                                  <Typography>
                                    <strong>Current Edit Revision:</strong>{' '}
                                    <br />
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
                              <Grid item md={7} xs={12}>
                                <Alert severity="warning" variant={'standard'}>
                                  Edits have been made to this record by
                                  different users that cannot be automatically
                                  merged. Resolve the conflicting fields before
                                  editing to prevent creating further versions
                                  of this record.
                                  <Box sx={{my: 1}}>
                                    <ResolveButton
                                      handleChange={handleChange}
                                    />
                                  </Box>
                                  {isalerting && draft_id === undefined && (
                                    <Box>
                                      Or, select a version and {'  '}
                                      <Button
                                        variant="text"
                                        color={'primary'}
                                        size={'small'}
                                        onClick={() => setIsalerting(false)}
                                      >
                                        {'  '}Edit anyway
                                      </Button>
                                    </Box>
                                  )}
                                </Alert>
                              </Grid>
                            </Grid>
                          </Box>
                          <Box>
                            {(isalerting === false ||
                              draft_id !== undefined) && (
                              <RecordData
                                project_id={project_id!}
                                record_id={record_id!}
                                hrid={hrid}
                                record_type={record_type}
                                revision_id={updatedrevision_id!}
                                ui_specification={uiSpec}
                                draft_id={draft_id}
                                conflictfields={conflictfields}
                                handleChangeTab={handleChange}
                                isSyncing={isSyncing.toString()}
                                isDraftSaving={isDraftSaving}
                                draftLastSaved={draftLastSaved}
                                draftError={draftError}
                                handleSetIsDraftSaving={setIsDraftSaving}
                                handleSetDraftLastSaved={setDraftLastSaved}
                                handleSetDraftError={setDraftError}
                                parentRecords={parentLinks}
                                record_to_field_links={relatedRecords}
                                is_link_ready={is_link_ready}
                                handleUnlink={handleUnlink}
                                setRevision_id={setrevision_id}
                                mq_above_md={mq_above_md}
                                setProgress={setProgress}
                                buttonRef={buttonRef}
                              />
                            )}
                          </Box>
                        </Box>
                      ) : (
                        <RecordData
                          project_id={project_id!}
                          record_id={record_id!}
                          hrid={hrid}
                          record_type={record_type}
                          revision_id={updatedrevision_id!}
                          ui_specification={uiSpec}
                          draft_id={draft_id}
                          conflictfields={conflictfields}
                          handleChangeTab={handleChange}
                          isDraftSaving={isDraftSaving}
                          isSyncing={isSyncing.toString()}
                          handleSetIsDraftSaving={setIsDraftSaving}
                          handleSetDraftLastSaved={setDraftLastSaved}
                          handleSetDraftError={setDraftError}
                          draftLastSaved={draftLastSaved}
                          draftError={draftError}
                          parentRecords={parentLinks}
                          record_to_field_links={relatedRecords}
                          is_link_ready={is_link_ready}
                          handleUnlink={handleUnlink}
                          setRevision_id={setrevision_id}
                          mq_above_md={mq_above_md}
                          setProgress={setProgress}
                          buttonRef={buttonRef}
                        />
                      )}
                    </Box>
                  </TabPanel>
                </React.Fragment>
              );
            }
          })()}

          <TabPanel value="2" style={{padding: theme.spacing(2)}}>
            <Box />
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
          <TabPanel value="3" style={{padding: theme.spacing(2)}}>
            <RecordMeta
              project_id={project_id!}
              record_id={record_id!}
              revision_id={updatedrevision_id!}
            />
            <Box mt={2}>
              <Typography variant={'h5'} gutterBottom>
                {draft_id ? 'Discard Draft' : 'Delete Record'}
              </Typography>
              <RecordDelete
                project_id={project_id!}
                record_id={record_id!}
                revision_id={revision_id!}
                draft_id={draft_id ? draft_id : null}
                show_label={true}
                handleRefresh={handleRefresh}
              />
            </Box>
          </TabPanel>
          <TabPanel
            value="4"
            style={{
              padding: theme.spacing(0),
              overflowX: 'auto',
              backgroundColor: '#EEE',
            }}
          >
            <Box>
              <BasicDialog
                handleClose={() => setOpen(false)}
                handleOpen={() => setOpen(true)}
                handleConfirm={handleConfirm}
                content={`This record has
                ${Object.keys(conflicts['available_heads']).length}
                conflicting instances. Resolve these conflicts before
                continuing.`}
                continue={'continue'}
                cancel={'Resolve'}
                open={open}
              />
              {isSyncing !== null && (
                <ConflictForm
                  project_id={project_id!}
                  record_id={record_id!}
                  revision_id={updatedrevision_id}
                  ui_specification={uiSpec}
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
    </Box>
  );
}
