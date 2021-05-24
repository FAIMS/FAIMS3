import React, {useEffect, useState} from 'react';
import {
  Avatar,
  Box,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  Button,
  IconButton,
  Typography,
  CircularProgress,
} from '@material-ui/core';
import {EmailShareButton} from 'react-share';
import MailOutlineIcon from '@material-ui/icons/MailOutline';
import {Plugins} from '@capacitor/core';
const {Share} = Plugins;
import {Link as RouterLink} from 'react-router-dom';
import * as ROUTES from '../../constants/routes';
import {makeStyles} from '@material-ui/core/styles';
import {ProjectInformation, ProjectObject} from '../../datamodel';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import ObservationsTable from './observationsTable';

type ProjectCardProps = {
  project: ProjectObject | ProjectInformation;
  listing_id_project_id?: string;
  showObservations: boolean;
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
  const {project, listing_id_project_id, showObservations} = props;
  const classes = useStyles();
  const [loading, setLoading] = useState(true);

  const bull = <span className={classes.bullet}>•</span>;
  const webShare = 'share' in navigator; // Detect whether webshare api is available in browser
  const project_url = ROUTES.PROJECT + (listing_id_project_id || 'dummy');

  const getShare = async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const shareRet = await Share.share({
      title: 'FAIMS Project: ' + project.name,
      text: 'Really awesome project you need to see right now',
      url: project_url,
      dialogTitle: 'Share ' + project.name,
    });
  };

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
        <Card>
          <CardHeader
            className={classes.cardHeader}
            avatar={
              <Avatar aria-label={project.name} className={classes.avatar}>
                {project.name.charAt(0)}
              </Avatar>
            }
            action={
              <IconButton aria-label="settings">
                <MoreVertIcon />
              </IconButton>
            }
            title={project.name}
            subheader={project.last_updated}
          />
          <CardContent>
            <Typography variant="body2" color="textSecondary" component="p">
              {project.description}
            </Typography>

            {showObservations ? (
              <Box mt={1} mb={2}>
                <ObservationsTable
                  listing_id_project_id={listing_id_project_id}
                  restrictRows={10}
                />
              </Box>
            ) : (
              ''
            )}
            <Typography
              className={classes.pos}
              color="textSecondary"
              variant="subtitle2"
              style={{marginTop: '20px'}}
            >
              10 team members {bull} status: {project.status} {bull} Last
              updated {project.last_updated}
            </Typography>
          </CardContent>
          <CardActions>
            <Button
              size="small"
              color="primary"
              to={project_url}
              component={RouterLink}
            >
              View
            </Button>
            {webShare ? (
              <Button size="small" color="primary" onClick={getShare}>
                Share
              </Button>
            ) : (
              <EmailShareButton
                url={project_url}
                subject={'FAIMS Project: ' + project.name}
                body={"I'd like to share this FAIMS project with you "}
                resetButtonStyle={false}
                className={
                  'MuiButtonBase-root MuiButton-root MuiButton-text MuiButton-textPrimary MuiButton-textSizeSmall MuiButton-sizeSmall'
                }
              >
                <span className="MuiButton-label">
                  <span className="MuiButton-startIcon MuiButton-iconSizeSmall">
                    <MailOutlineIcon
                      className="MuiSvgIcon-root"
                      viewBox={'0 0 24 24'}
                    />
                  </span>
                  Share
                </span>
                <span className="MuiTouchRipple-root" />
              </EmailShareButton>
            )}
          </CardActions>
        </Card>
      )}
    </React.Fragment>
  );
}
ProjectCard.defaultProps = {
  showObservations: false,
};
