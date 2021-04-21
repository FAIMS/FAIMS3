import React from 'react';
import {
  createStyles,
  withStyles,
  WithStyles,
  Theme,
} from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Container from '@material-ui/core/Container';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Box from '@material-ui/core/Box';
import {FAIMSForm} from './form';
import grey from '@material-ui/core/colors/grey';

interface TabPanelProps {
  children?: React.ReactNode;
  index: any;
  value: any;
}

function TabPanel(props: TabPanelProps) {
  const {children, value, index, ...other} = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`scrollable-auto-tabpanel-${index}`}
      aria-labelledby={`scrollable-auto-tab-${index}`}
      {...other}
    >
      {value === index && <Box p={3}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: any) {
  return {
    id: `project-nav-scrollable-tab-${index}`,
    'aria-controls': `project-nav-scrollable-tab-${index}`,
  };
}

const styles = (theme: Theme) =>
  createStyles({
    root: {
      flexGrow: 1,
      width: '100%',
      backgroundColor: theme.palette.background.paper,
    },
  });

interface ProjectNavTabsProps extends WithStyles<typeof styles> {
  classes: any;
  projectList: Array<object>;
}

type ProjectNavTabsState = {
  activeTab: any;
};

class ProjectNavTabs extends React.Component<
  ProjectNavTabsProps,
  ProjectNavTabsState
> {
  constructor(props) {
    super(props);
    this.state = {
      activeTab: this.props.projectList[0]['project_id'],
    };
    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(event, value) {
    this.setState({activeTab: value.toString()});
  }

  render() {
    const {classes} = this.props;
    const {activeTab} = this.state;

    return (
      <div className={classes.root}>
        <AppBar position="static" color="default">
          <Tabs
            value={activeTab}
            onChange={this.handleChange}
            indicatorColor="primary"
            textColor="primary"
            variant="scrollable"
            scrollButtons="auto"
            aria-label="scrollable auto tabs example"
          >
            {this.props.projectList.map(project => {
              return (
                <Tab
                  label={project['pretty_name']}
                  value={project['project_id']}
                  key={'projectNavTab' + project['project_id']}
                  {...a11yProps(project['project_id'])}
                />
              );
            })}
          </Tabs>
        </AppBar>

        <Container maxWidth="md">
          {this.props.projectList.map(project => {
            return (
              <TabPanel
                value={activeTab.toString()}
                index={project['project_id'].toString()}
                key={'projectNavTabPanel' + project['project_id']}
              >
                <Box bgcolor={grey[200]} p={2} mb={2}>
                  <pre style={{margin: 0}}>
                    {JSON.stringify(project, null, 2)}
                  </pre>
                </Box>
                <Box p={2} mb={2}>
                  <strong>VIEW STEPPER GOES HERE</strong>
                </Box>
                <FAIMSForm activeProjectID={activeTab} />
              </TabPanel>
            );
          })}
        </Container>
      </div>
    );
  }
}

export default withStyles(styles)(ProjectNavTabs);
