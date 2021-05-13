import {
  Avatar,
  Box,
  Card,
  CardContent,
  Grid,
  IconButton,
  Typography,
} from '@material-ui/core';
import {Link as RouterLink} from 'react-router-dom';
import * as ROUTES from '../../constants/routes';
import CallMade from '@material-ui/icons/CallMade';
import React from 'react';
import {makeStyles} from '@material-ui/core/styles';
import {ProjectObject} from '../../datamodel';
type ProjectCardProps = {
  project: ProjectObject;
  showTopTenObs: boolean;
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
  avatar: {
    borderRadius: 8,
    // backgroundColor: red[500],
    backgroundColor: theme.palette.secondary.light,
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
}));

export default function ProjectCard(props: ProjectCardProps) {
  const {project, showTopTenObs} = props;
  const classes = useStyles();
  const bull = <span className={classes.bullet}>•</span>;
  const BasicProfile = (
    <Grid container spacing={1} direction="row" alignItems="center">
      <Grid item>
        <Avatar className={classes.avatar}>JS</Avatar>
      </Grid>
      <Grid item>
        <Typography className={classes.overline} color="textSecondary">
          PROJECT LEAD
        </Typography>
        <Typography className={classes.name} color="textSecondary">
          J Smith
        </Typography>
      </Grid>
    </Grid>
  );
  return (
    <Card variant="outlined">
      <CardContent>
        <Grid container>
          <Grid item xs={10}>
            <Typography component="h2">
              <b>{project.name}</b>
            </Typography>
            <Typography
              className={classes.pos}
              color="textSecondary"
              variant="subtitle2"
            >
              10 team members {bull} status: {project.status} {bull} Last
              updated {project.last_updated}
            </Typography>
          </Grid>
          <Grid item xs={2}>
            <IconButton
              style={{float: 'right'}}
              component={RouterLink}
              to={ROUTES.PROJECT + project._id}
            >
              <CallMade />
            </IconButton>
          </Grid>
        </Grid>

        <Typography variant="body2" component="p" className={classes.pos}>
          {project.description}
        </Typography>
        {showTopTenObs ? (
          <Box mt={1} mb={2}>
            <i>
              observation component goes here. tabular display of 10 most
              recent?
            </i>
          </Box>
        ) : (
          ''
        )}
        {BasicProfile}
      </CardContent>
    </Card>
  );
}
ProjectCard.defaultProps = {
  showTopTenObs: false,
};
