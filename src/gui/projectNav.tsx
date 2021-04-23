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
import {ProjectsList, ProjectUIModel} from '../datamodel';
import {NumberSchema} from 'yup';
import {syncUISpecs, SyncingUiSpecs} from '../uiSpecification';

interface TabPanelProps {
  children?: React.ReactNode;
  index: any;
  index_of_active: any;
}

function TabPanel(props: TabPanelProps) {
  const {children, index_of_active: value, index, ...other} = props;

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
  projectList: ProjectsList;
}

type ProjectNavTabsState = {
  activeTab: string;
  uiSpecs: SyncingUiSpecs;
};

class ProjectNavTabs extends React.Component<
  ProjectNavTabsProps,
  ProjectNavTabsState
> {
  uiSpecsUpdate(uiSpecs: SyncingUiSpecs) {
    this.setState({...this.state, uiSpecs: uiSpecs});
  }

  constructor(props) {
    super(props);
    this.state = {
      activeTab: '',
      uiSpecs: syncUISpecs(props.projectList, this.uiSpecsUpdate.bind(this)),
    };
    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(event, value) {
    this.setState({activeTab: value.toString()});
  }

  render() {
    const {classes} = this.props;
    let {activeTab} = this.state;

    if (Object.keys(this.props.projectList).length === 0) {
      // Before the projects are initialized,
      // rendering this component displays a loading screen
      return (
        <div>
          Loading first project: 'project_syncing' event hasn't triggered yet
        </div>
      );
    } else if (this.props.projectList[activeTab] === undefined) {
      // Immediately after loading screen is finished loading, there
      // is no selected tab, so default to the first one:
      activeTab = Object.keys(this.props.projectList)[0];
    }

    syncUISpecs(
      this.props.projectList,
      this.uiSpecsUpdate.bind(this),
      this.state.uiSpecs
    );

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
            {Object.keys(this.props.projectList).map(
              (active_id, project_index) => {
                const project = this.props.projectList[active_id];
                return (
                  <Tab
                    label={project.name}
                    value={active_id}
                    key={'projectNavTab' + active_id}
                    {...a11yProps(project._id)}
                  />
                );
              }
            )}
          </Tabs>
        </AppBar>

        <Container maxWidth="md">
          {Object.keys(this.props.projectList).map(
            (active_id, project_index) => {
              const project = this.props.projectList[active_id];
              const uiSpec = this.state.uiSpecs[active_id].uiSpec;
              const uiSpecError = this.state.uiSpecs[active_id].error || null;
              return (
                <TabPanel
                  index_of_active={activeTab}
                  index={active_id}
                  key={'projectNavTabPanel' + active_id}
                >
                  <Box bgcolor={grey[200]} p={2} mb={2}>
                    <pre style={{margin: 0}}>
                      {JSON.stringify(project, null, 2)}
                    </pre>
                  </Box>
                  <Box p={2} mb={2}>
                    <strong>VIEW STEPPER GOES HERE</strong>
                  </Box>
                  <>
                    {uiSpecError === null ? (
                      uiSpec === null ? (
                        <span>Loading UI Model...</span>
                      ) : (
                        <FAIMSForm
                          uiSpec={uiSpec}
                          activeProjectID={active_id}
                        />
                      )
                    ) : (
                      <pre>{JSON.stringify(uiSpecError, null, 2)}</pre>
                    )}
                  </>
                </TabPanel>
              );
            }
          )}
        </Container>
      </div>
    );
  }
}

export default withStyles(styles)(ProjectNavTabs);
