import React, {useContext, useEffect, useState} from 'react';
import {useParams, Link as RouterLink} from 'react-router-dom';
import {
  Box,
  Grid,
  Typography,
  Paper,
  CircularProgress,
  Button,
} from '@mui/material';
import {ProjectInformation} from '../../../../datamodel/ui';
import {get_autoincrement_references_for_project} from '../../../../datamodel/autoincrement';
import {AutoIncrementReference} from '../../../../datamodel/database';
import AutoIncrementEditForm from '../../autoincrement/edit-form';

interface AutoIncrementerSettingsListProps {
  project_info: ProjectInformation;
}
export default function AutoIncrementerSettingsList(
  props: AutoIncrementerSettingsListProps
) {
  const [references, setReferences] = React.useState(
    [] as AutoIncrementReference[]
  );
  useEffect(() => {
    get_autoincrement_references_for_project(props.project_info.project_id)
      .then(refs => {
        setReferences(refs);
      })
      .catch(console.error /*TODO*/);
  }, [props.project_info.project_id]);

  return (
    <Grid container spacing={2}>
      {references.length === 0 ? 'This project has no Auto-Incrementers' : ''}
      {references.map(ai => {
        const label = ai.label ?? ai.form_id;
        return (
          <Grid item xs={12} sm={6} md={4}>
            <Typography variant={'overline'}>
              Edit Allocations for {label}
            </Typography>
            <Box
              component={Paper}
              variant={'outlined'}
              p={2}
              elevation={0}
            >
              <AutoIncrementEditForm
                project_id={props.project_info.project_id}
                form_id={ai.form_id}
                field_id={ai.field_id}
                label={label}
              />
            </Box>
          </Grid>
        );
      })}
    </Grid>
  );
}
