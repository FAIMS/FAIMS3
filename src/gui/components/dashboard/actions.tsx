import React from 'react';
import {makeStyles} from '@material-ui/core/styles';
import {useHistory} from 'react-router-dom';
import {Grid, Button, TextField} from '@material-ui/core';
import Autocomplete from '@material-ui/lab/Autocomplete';
// import Skeleton from '@material-ui/lab/Skeleton';
import * as ROUTES from '../../../constants/routes';
import {createdProjects} from '../../../sync';
type DashboardActionProps = {
  pouchProjectList: typeof createdProjects;
};
const useStyles = makeStyles(() => ({
  fullHeightButton: {
    height: '100%',
  },
}));

export default function DashboardActions(props: DashboardActionProps) {
  const {pouchProjectList} = props;
  const classes = useStyles();
  const history = useHistory();
  const options = Object.keys(pouchProjectList).map(project_id => ({
    title: pouchProjectList[project_id].project.name,
    url: ROUTES.PROJECT + project_id,
  }));
  const [value, setValue] = React.useState(
    options.length > 0 ? options[0] : null
  );
  const [inputValue, setInputValue] = React.useState('');
  const handleSubmit = () => {
    if (value !== null) {
      history.push(value.url + ROUTES.OBSERVATION_CREATE);
    }
  };
  return (
    <React.Fragment>
      {options.length > 0 ? (
        <form onSubmit={handleSubmit}>
          <Grid container={true}>
            <Grid>
              <Autocomplete
                id="combo-box-demo"
                value={value}
                onChange={(event, newValue) => {
                  if (newValue !== null) {
                    setValue(newValue);
                  }
                }}
                size={'small'}
                inputValue={inputValue}
                onInputChange={(event, newInputValue) => {
                  setInputValue(newInputValue);
                }}
                options={options}
                getOptionLabel={option => option.title}
                style={{width: 300}}
                openOnFocus={true}
                renderInput={params => (
                  <TextField
                    {...params}
                    label="Select Project"
                    variant="outlined"
                  />
                )}
              />
            </Grid>
            <Grid>
              <Button
                classes={{root: classes.fullHeightButton}}
                variant="contained"
                color="primary"
                size={'medium'}
                type={'submit'}
                style={{marginLeft: '5px'}}
              >
                Add
              </Button>
            </Grid>
          </Grid>
        </form>
      ) : (
        'No Projects Found'
      )}
    </React.Fragment>
  );
}
