import React, {useState} from 'react';
import {makeStyles} from '@material-ui/core/styles';
import {NavLink} from 'react-router-dom';
import {
  Container,
  Breadcrumbs,
  Typography,
  Box,
  Button,
  Card,
  CardHeader,
  CardMedia,
  CardContent,
  CardActions,
  Collapse,
  Grid,
  Paper,
  Avatar,
  IconButton,
} from '@material-ui/core';
import * as ROUTES from '../../constants/routes';

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
}));

export default function Home() {
  const classes = useStyles();
  const bull = <span className={classes.bullet}>•</span>;

  const [projects, setProjects] = useState([
    {
      title: 'Project 1',
      last_updated: '6/02/2021',
      created: '1/02/2021',
      status: 'active',
      team_member_count: '6',
      description:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    },
    {
      title: 'Project 2',
      last_updated: '6/02/2020',
      created: '1/01/2019',
      status: 'closed',
      team_member_count: '4',
      description:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    },
    {
      title: 'Project 3',
      last_updated: '6/02/2020',
      created: '1/01/2019',
      status: 'closed',
      team_member_count: '4',
      description:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
    },
  ]);

  return (
    <Container maxWidth="md">
      <Box
        display="flex"
        flexDirection="row-reverse"
        p={1}
        m={1}
        // bgcolor="background.paper"
      >
        <Breadcrumbs aria-label="breadcrumb">
          <NavLink to={ROUTES.INDEX}>Index</NavLink>
          <Typography color="textPrimary">Home</Typography>
        </Breadcrumbs>
      </Box>
      <div className={classes.gridRoot}>
        <Grid container spacing={1}>
          {projects.map(project => {
            return (
              <Grid item xs={12} sm={4} md={4} spacing={2}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h5" component="h2">
                      <b>{project.title}</b>
                    </Typography>
                    <Typography className={classes.pos} color="textSecondary" variant="subtitle2">
                      {project.team_member_count} team members {bull} status:{' '}
                      {project.status}
                    </Typography>
                    <Typography variant="body2" component="p" className={classes.pos}>
                      {project.description}
                    </Typography>
                    <Typography
                        color="textSecondary"
                        variant="subtitle2"
                        gutterBottom
                    >
                      Last updated {project.last_updated}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button size="small">view</Button>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </div>
    </Container>
  );
}

// import React from 'react';
// import {NavLink, withRouter, RouteComponentProps} from 'react-router-dom';
// import clsx from 'clsx';
// import * as ROUTES from '../../constants/routes';
// import {
//   Container,
//   Breadcrumbs,
//   Typography,
//   Box,
//   Card,
//   CardHeader,
//   CardMedia,
//   CardContent,
//   CardActions,
//   Collapse,
//   Avatar,
//   IconButton,
// } from '@material-ui/core';
// import {red} from '@material-ui/core/colors';
// import FavoriteIcon from '@material-ui/icons/Favorite';
// import ShareIcon from '@material-ui/icons/Share';
// import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
// import MoreVertIcon from '@material-ui/icons/MoreVert';
// import {
//   createStyles,
//   Theme,
//   withStyles,
//   WithStyles,
// } from '@material-ui/core/styles';
//
// const styles = (theme: Theme) =>
//   createStyles({
//     root: {
//       maxWidth: 345,
//     },
//     media: {
//       height: 0,
//       paddingTop: '56.25%', // 16:9
//     },
//     expand: {
//       transform: 'rotate(0deg)',
//       marginLeft: 'auto',
//       transition: theme.transitions.create('transform', {
//         duration: theme.transitions.duration.shortest,
//       }),
//     },
//     expandOpen: {
//       transform: 'rotate(180deg)',
//     },
//     avatar: {
//       backgroundColor: red[500],
//     },
//   });
//
// interface HomeProps extends RouteComponentProps, WithStyles<typeof styles> {
//   classes: any;
//   // project: string;
// }
//
// type HomeState = {
//   expanded: boolean;
// };
//
// export class Home extends React.Component<HomeProps, HomeState> {
//   constructor(props: HomeProps) {
//     super(props);
//
//     this.state = {
//       expanded: false,
//     };
//     this.handleExpandClick = this.handleExpandClick.bind(this);
//   }
//
//   handleExpandClick() {
//     this.setState({expanded: !this.state.expanded});
//   }
//   render() {
//     const {classes} = this.props;
//     const {expanded} = this.state;
//     console.log(this.props);
//     return (
//       <Container maxWidth="md">
//         <Box
//           display="flex"
//           flexDirection="row-reverse"
//           p={1}
//           m={1}
//           // bgcolor="background.paper"
//         >
//           <Breadcrumbs aria-label="breadcrumb">
//             <NavLink to={ROUTES.INDEX}>Index</NavLink>
//             <Typography color="textPrimary">Home</Typography>
//           </Breadcrumbs>
//         </Box>
//         <Card className={classes.root}>
//           <CardHeader
//             avatar={
//               <Avatar aria-label="recipe" className={classes.avatar}>
//                 R
//               </Avatar>
//             }
//             action={
//               <IconButton aria-label="settings">
//                 <MoreVertIcon />
//               </IconButton>
//             }
//             title="Shrimp and Chorizo Paella"
//             subheader="September 14, 2016"
//           />
//           <CardMedia
//             className={classes.media}
//             image="/static/images/cards/paella.jpg"
//             title="Paella dish"
//           />
//           <CardContent>
//             <Typography variant="body2" color="textSecondary" component="p">
//               This impressive paella is a perfect party dish and a fun meal to
//               cook together with your guests. Add 1 cup of frozen peas along
//               with the mussels, if you like.
//             </Typography>
//           </CardContent>
//           <CardActions disableSpacing>
//             <IconButton aria-label="add to favorites">
//               <FavoriteIcon />
//             </IconButton>
//             <IconButton aria-label="share">
//               <ShareIcon />
//             </IconButton>
//             <IconButton
//               className={clsx(classes.expand, {
//                 [classes.expandOpen]: expanded,
//               })}
//               onClick={this.handleExpandClick}
//               aria-expanded={expanded}
//               aria-label="show more"
//             >
//               <ExpandMoreIcon />
//             </IconButton>
//           </CardActions>
//           <Collapse in={expanded} timeout="auto" unmountOnExit>
//             <CardContent>
//               <Typography paragraph>Method:</Typography>
//               <Typography paragraph>
//                 Heat 1/2 cup of the broth in a pot until simmering, add saffron
//                 and set aside for 10 minutes.
//               </Typography>
//               <Typography paragraph>
//                 Heat oil in a (14- to 16-inch) paella pan or a large, deep
//                 skillet over medium-high heat. Add chicken, shrimp and chorizo,
//                 and cook, stirring occasionally until lightly browned, 6 to 8
//                 minutes. Transfer shrimp to a large plate and set aside, leaving
//                 chicken and chorizo in the pan. Add pimentón, bay leaves,
//                 garlic, tomatoes, onion, salt and pepper, and cook, stirring
//                 often until thickened and fragrant, about 10 minutes. Add
//                 saffron broth and remaining 4 1/2 cups chicken broth; bring to a
//                 boil.
//               </Typography>
//               <Typography paragraph>
//                 Add rice and stir very gently to distribute. Top with artichokes
//                 and peppers, and cook without stirring, until most of the liquid
//                 is absorbed, 15 to 18 minutes. Reduce heat to medium-low, add
//                 reserved shrimp and mussels, tucking them down into the rice,
//                 and cook again without stirring, until mussels have opened and
//                 rice is just tender, 5 to 7 minutes more. (Discard any mussels
//                 that don’t open.)
//               </Typography>
//               <Typography>
//                 Set aside off of the heat to let rest for 10 minutes, and then
//                 serve.
//               </Typography>
//             </CardContent>
//           </Collapse>
//         </Card>
//       </Container>
//     );
//   }
// }
// export default withRouter(withStyles(styles)(Home));
// // export default withStyles(styles)(withRouter(Home));
// // export default withStyles(styles)(Home);
