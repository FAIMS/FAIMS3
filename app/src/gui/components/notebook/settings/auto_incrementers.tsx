import React, {useEffect, useState} from 'react';
import {Box, Grid, Typography, Paper, Alert, Button} from '@mui/material';
import {ProjectInformation, ProjectUIModel} from '@faims3/data-model';
import {getAutoincrementReferencesForProject} from '../../../../local-data/autoincrement';
import {AutoIncrementReference} from '@faims3/data-model';
import {AutoIncrementEditForm} from '../../autoincrement/edit-form';
import {logError} from '../../../../logging';

interface AutoIncrementerSettingsListProps {
  project_info: ProjectInformation;
  uiSpec: ProjectUIModel;
}

export default function AutoIncrementerSettingsList(
  props: AutoIncrementerSettingsListProps
) {
  const [open, setOpen] = useState(false);
  const [references, setReferences] = useState([] as AutoIncrementReference[]);
  useEffect(() => {
    getAutoincrementReferencesForProject(props.project_info.project_id)
      .then(refs => {
        setReferences(refs);
      })
      .catch(error => logError(error));
  }, [props.project_info.project_id]);

  return (
    <>
      {references.length === 0 ? (
        <></>
      ) : (
        <Box component={Paper} variant={'outlined'} p={2} elevation={0}>
          <Typography variant={'h6'} gutterBottom>
            Edit auto-incrementers
          </Typography>
          <Typography gutterBottom>
            View and modify the range settings for auto-incrementers. These are
            used to generate unique identifiers for records within a defined
            range.
          </Typography>

          {references.map(ai => {
            const label = ai.label ?? '';
            return (
              <Grid
                item
                xs={12}
                sm={6}
                md={6}
                lg={4}
                key={
                  'autoincrementer_range_' + ai.form_id + ai.field_id + ai.label
                }
              >
                <Box mt={1}>
                  <AutoIncrementEditForm
                    project_id={props.project_info.project_id}
                    form_id={ai.form_id}
                    field_id={ai.field_id}
                    label={label}
                    open={open}
                    handleClose={() => setOpen(false)}
                  />
                  <Button
                    variant="outlined"
                    color={'primary'}
                    onClick={() => {
                      setOpen(true);
                    }}
                  >
                    {label}
                  </Button>
                </Box>
              </Grid>
            );
          })}
        </Box>
      )}
    </>
  );
}
