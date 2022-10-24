import React, {useEffect} from 'react';
import {Box, Grid, Typography, Paper, Alert} from '@mui/material';
import {ProjectInformation, ProjectUIModel} from '../../../../datamodel/ui';
import {get_autoincrement_references_for_project} from '../../../../datamodel/autoincrement';
import {AutoIncrementReference} from '../../../../datamodel/database';
import AutoIncrementEditForm from '../../autoincrement/edit-form';
interface AutoIncrementerSettingsListProps {
  project_info: ProjectInformation;
  uiSpec: ProjectUIModel;
}

function get_form(section_id: string, uiSpec: ProjectUIModel) {
  let form = '';
  uiSpec.visible_types.map(viewset =>
    uiSpec.viewsets[viewset].views.includes(section_id)
      ? (form = uiSpec.viewsets[viewset].label ?? viewset)
      : viewset
  );
  return form;
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
      {references.length === 0 ? (
        <Grid item xs={12} sm={6} md={6}>
          <Box component={Paper} variant={'outlined'} elevation={0}>
            <Typography variant={'h6'} sx={{m: 2}}>
              Edit Allocations
            </Typography>
            <Alert severity={'info'}>
              This project has no Auto-Incrementers
            </Alert>
          </Box>
        </Grid>
      ) : (
        ''
      )}
      {references.map(ai => {
        // display form section label for user to fill Auto correctly
        const section =
          props.uiSpec['views'][ai.form_id]['label'] ?? ai.form_id;
        const label =
          get_form(ai.form_id, props.uiSpec) +
            ' <' +
            section +
            '> ' +
            ai.label ?? '';
        return (
          <Grid
            item
            xs={12}
            sm={6}
            md={6}
            lg={4}
            key={'autoincrementer_range_' + ai.form_id + ai.field_id + ai.label}
          >
            <Box component={Paper} variant={'outlined'} p={2} elevation={0}>
              <Typography variant={'h6'} sx={{mb: 2}}>
                Edit Allocations for {label}
              </Typography>
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
