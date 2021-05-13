import React from 'react';
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
} from '@material-ui/core';
import {EmailShareButton} from 'react-share';
import MailOutlineIcon from '@material-ui/icons/MailOutline';
import {Plugins} from '@capacitor/core';
const {Share} = Plugins;
import {Link as RouterLink} from 'react-router-dom';
import * as ROUTES from '../../constants/routes';
import {makeStyles} from '@material-ui/core/styles';
import {ProjectObject} from '../../datamodel';
import MoreVertIcon from '@material-ui/icons/MoreVert';
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
  const {project, showTopTenObs} = props;
  const classes = useStyles();
  const bull = <span className={classes.bullet}>•</span>;
  const project_url = ROUTES.PROJECT + project._id;
  const webShare = 'share' in navigator; // Detect whether webshare api is available in browser

  const getShare = async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const shareRet = await Share.share({
      title: 'See cool stuff',
      text: 'Really awesome thing you need to see right meow',
      url: 'http://ionicframework.com/',
      dialogTitle: 'Share with buddies',
    });
  };

  return (
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
        <Typography
          className={classes.pos}
          color="textSecondary"
          variant="subtitle2"
          style={{marginTop: '20px'}}
        >
          10 team members {bull} status: {project.status} {bull} Last updated{' '}
          {project.last_updated}
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
  );
}
ProjectCard.defaultProps = {
  showTopTenObs: false,
};
