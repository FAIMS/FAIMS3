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
 * Filename: projectCard.tsx
 * Description:
 *   TODO
 */

import React, {useEffect, useState} from 'react';
import {
  Avatar,
  Box,
  Button,
  Card as MuiCard,
  CardActions,
  CardContent,
  CardHeader,
  Typography,
  CircularProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Grid,
  TextField,
} from '@material-ui/core';

// import {EmailShareButton} from 'react-share';
// import MailOutlineIcon from '@material-ui/icons/MailOutline';
// import {Plugins} from '@capacitor/core';
// const {Share} = Plugins;
import {Link as RouterLink} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {makeStyles} from '@material-ui/core/styles';
import {ProjectInformation} from '../../../datamodel/ui';
import DraftsTable from '../record/draft_table';
import {RecordsBrowseTable, RecordsSearchTable} from '../record/table';
import MetadataRenderer from '../metadataRenderer';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import ProjectCardHeaderAction from './cardHeaderAction';
import ProjectSync from './sync';
import {getUiSpecForProject} from '../../../uiSpecification';
import {ProjectUIViewsets} from '../../../datamodel/typesystem';
import RangeHeader from './RangeHeader';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import {useTheme} from '@material-ui/core/styles';

type ProjectSearchCardProps = {
  project: ProjectInformation;
};

type ProjectCardProps = {
  project: ProjectInformation;
  showRecords: boolean;
  showDrafts: boolean;
  listView: boolean;
  dashboard: boolean;
};

const useStyles = makeStyles(theme => ({
  gridRoot: {
    flexGrow: 1,
    padding: theme.spacing(2),
  },
  bullet: {
    display: 'inline-block',
    margin: '0 2px',
    transform: 'scale(0.8)',
  },
  title: {
    fontSize: 14,
  },
  pos: {
    marginBottom: 12,
  },
  cardHeader: {
    alignItems: 'flex-start',
  },
  avatar: {
    borderRadius: 8,
    // backgroundColor: red[500],
    backgroundColor: theme.palette.primary.light,
  },
  overline: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: 500,
  },
  status: {
    display: 'inline',
    // fontSize: '0.8rem',
  },
  NoPaddding: {
    paddingTop: 0,
    [theme.breakpoints.down('sm')]: {
      paddingLeft: 0,
      paddingRight: 0,
    },
  },
  LeftPaddding: {
    [theme.breakpoints.down('sm')]: {
      paddingLeft: 10,
    },
  },
}));

export default function Card(props: ProjectCardProps) {
  const {project, showRecords, showDrafts, listView, dashboard} = props;
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const project_url = ROUTES.PROJECT + project.project_id;
  const [viewsets, setViewsets] = useState<null | ProjectUIViewsets>(null);
  const theme = useTheme();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));
  // const webShare = 'share' in navigator; // Detect whether webshare api is available in browser

  // const getShare = async () => {
  //   // eslint-disable-next-line @typescript-eslint/no-unused-vars
  //   const shareRet = await Share.share({
  //     title: 'FAIMS Project: ' + project.name,
  //     text: 'Really awesome project you need to see right now',
  //     url: project_url,
  //     dialogTitle: 'Share ' + project.name,
  //   });
  // };
  console.log(project);

  useEffect(() => {
    if (typeof project !== 'undefined' && Object.keys(project).length > 0) {
      setLoading(false);
    }
    console.log(project.project_id);
  }, [project]);

  useEffect(() => {
    getUiSpecForProject(project.project_id).then(
      uiSpec => {
        setViewsets(uiSpec.viewsets);
      },
      () => {}
    );
  }, [project.project_id]);

  return (
    <React.Fragment>
      {loading ? (
        <CircularProgress size={12} thickness={4} />
      ) : dashboard ? (
        <List style={{padding: 0}}>
          <ListItem
            button
            alignItems="flex-start"
            component={RouterLink}
            to={project_url}
          >
            <ListItemAvatar>
              <Avatar aria-label={project.name} className={classes.avatar}>
                {project.name.charAt(0)}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={project.name}
              secondary={
                <React.Fragment>
                  <Typography
                    component="span"
                    variant="body2"
                    className={classes.status}
                    color="textSecondary"
                  >
                    Last updated {project.last_updated}
                  </Typography>
                  <br />
                  <Typography
                    component="span"
                    variant="body2"
                    className={classes.status}
                    color="textPrimary"
                  >
                    {project.description}
                  </Typography>
                </React.Fragment>
              }
            />
          </ListItem>
        </List>
      ) : (
        <MuiCard className={classes.NoPaddding}>
          <CardHeader
            className={classes.cardHeader}
            avatar={
              <Avatar aria-label={project.name} className={classes.avatar}>
                {project.name !== '' && project.name !== undefined
                  ? project.name.charAt(0)
                  : 'P'}
              </Avatar>
            }
            action={not_xs ? <ProjectCardHeaderAction project={project} /> : ''}
            title={
              <React.Fragment>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <b>{project.name}</b>&nbsp;
                </div>
              </React.Fragment>
            }
            subheader={<RangeHeader project={project} />}
          />

          <CardContent className={classes.NoPaddding}>
            <Box mb={2} className={classes.LeftPaddding}>
              <MetadataRenderer
                project_id={project.project_id}
                metadata_key={'project_status'}
                metadata_label={'Status'}
              />
              <MetadataRenderer
                project_id={project.project_id}
                metadata_key={'project_lead'}
                metadata_label={'Project Lead'}
              />{' '}
              <MetadataRenderer
                project_id={project.project_id}
                metadata_key={'lead_institution'}
                metadata_label={'Lead Institution'}
              />
              <Typography variant="body2" color="textPrimary" component="div">
                <MetadataRenderer
                  project_id={project.project_id}
                  metadata_key={'pre_description'}
                  chips={false}
                />
                <br />
              </Typography>
            </Box>

            {not_xs ? (
              ''
            ) : (
              <Box mt={1}>
                <CardActions style={{width: '100%'}}>
                  <ProjectCardHeaderAction project={project} />
                </CardActions>
              </Box>
            )}

            {showDrafts ? (
              <Box mt={1}>
                <DraftsTable
                  project_id={project.project_id}
                  maxRows={listView ? 10 : 25}
                  viewsets={viewsets}
                />
              </Box>
            ) : (
              ''
            )}

            {showRecords ? (
              <Box mt={1}>
                <RecordsBrowseTable
                  project_id={project.project_id}
                  maxRows={listView ? 10 : 25}
                  viewsets={viewsets}
                />
              </Box>
            ) : (
              ''
            )}
          </CardContent>
          <CardActions style={{width: '100%'}}>
            <Grid container alignItems="center">
              <Grid item xs={6} sm={6}>
                <Box>
                  {!listView && project.status !== 'new' ? (
                    <ProjectSync project={project} />
                  ) : (
                    ''
                  )}
                </Box>
              </Grid>
              <Grid item xs={6} sm={6}>
                {listView ? (
                  <Button
                    color="primary"
                    component={RouterLink}
                    to={project_url}
                    style={{float: 'right'}}
                  >
                    View Project
                    <ChevronRightIcon />
                  </Button>
                ) : (
                  ''
                )}
              </Grid>
            </Grid>
          </CardActions>
        </MuiCard>
      )}
    </React.Fragment>
  );
}
Card.defaultProps = {
  showRecords: false,
  showDrafts: true,
  listView: false,
  dashboard: false,
};

export function ProjectSearchCard(props: ProjectSearchCardProps) {
  const {project} = props;
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const theme = useTheme();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));

  useEffect(() => {
    if (typeof project !== 'undefined' && Object.keys(project).length > 0) {
      setLoading(false);
    }
  }, [project]);

  return (
    <React.Fragment>
      {loading ? (
        <CircularProgress size={12} thickness={4} />
      ) : (
        <MuiCard className={classes.NoPaddding}>
          <CardHeader
            className={classes.cardHeader}
            avatar={
              <Avatar aria-label={project.name} className={classes.avatar}>
                {project.name.charAt(0)}
              </Avatar>
            }
            action={not_xs ? <ProjectCardHeaderAction project={project} /> : ''}
            title={
              <React.Fragment>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <b>{project.name}</b>&nbsp;
                </div>
              </React.Fragment>
            }
            subheader={<RangeHeader project={project} />}
          />

          <CardContent style={{paddingTop: 0}} className={classes.NoPaddding}>
            <Box mb={2} className={classes.LeftPaddding}>
              <MetadataRenderer
                project_id={project.project_id}
                metadata_key={'project_status'}
                metadata_label={'Status'}
              />
              <MetadataRenderer
                project_id={project.project_id}
                metadata_key={'project_lead'}
                metadata_label={'Project Lead'}
              />{' '}
              <MetadataRenderer
                project_id={project.project_id}
                metadata_key={'lead_institution'}
                metadata_label={'Lead Institution'}
              />
            </Box>

            <Typography variant="body2" color="textPrimary" component="div">
              {project.description}&nbsp;
              <br />
            </Typography>

            {not_xs ? (
              ''
            ) : (
              <Box mt={1}>
                <CardActions style={{width: '100%'}}>
                  <ProjectCardHeaderAction project={project} />
                </CardActions>
              </Box>
            )}

            <Typography variant="body2" color="textPrimary" component="div">
              Search the data within the records (does not search record
              metadata):
            </Typography>
            <TextField
              id="query"
              type="search"
              onChange={event => {
                setQuery(event.target.value);
              }}
            />
            <Box mt={1}>
              <RecordsSearchTable
                project_id={project.project_id}
                maxRows={25}
                query={query}
              />
            </Box>
          </CardContent>
        </MuiCard>
      )}
    </React.Fragment>
  );
}
