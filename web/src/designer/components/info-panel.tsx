// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @file Design metadata editor: functional settings and typed information + custom fields.
 */

import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  FormHelperText,
  Grid,
  Typography,
  Card,
  Divider,
} from '@mui/material';
import DebouncedTextField from './debounced-text-field';
import {useState, useRef} from 'react';
import {useAppSelector, useAppDispatch} from '../state/hooks';
import {MdxEditor} from './mdx-editor';
import {MDXEditorMethods} from '@mdxeditor/editor';

import {config} from '@/constants';
import {config as designerConfig} from '../buildconfig';
import {
  customFieldRemoved,
  customFieldUpdated,
  informationUpdated,
} from '../state/metadata-reducer';
import {settingsUpdated} from '../store/slices/uiSpec';

/** Notebook design info: settings toggles, typed metadata, and custom key/value pairs. */
export const InfoPanel = () => {
  const information = useAppSelector(
    state => state.notebook.metadata.information
  );
  const custom = useAppSelector(state => state.notebook.metadata.custom ?? {});
  const settings = useAppSelector(
    state => state.notebook.uiSpec.present.settings
  );
  const dispatch = useAppDispatch();

  const purposeRef = useRef<MDXEditorMethods>(null);

  const [customFieldName, setCustomFieldName] = useState('');
  const [customFieldValue, setCustomFieldValue] = useState('');
  const [alert, setAlert] = useState('');

  const derivedFrom =
    designerConfig.templateProtections && information.derivedFromTemplateId
      ? information.derivedFromTemplateId
      : '';

  const addCustomField = () => {
    setAlert('');
    const key = customFieldName.trim();
    if (!key) {
      setAlert('Enter a field name.');
      return;
    }
    if (key in custom) {
      setAlert(`Field '${key}' already exists.`);
      return;
    }
    setCustomFieldName('');
    setCustomFieldValue('');
    dispatch(customFieldUpdated({key, value: customFieldValue}));
  };

  return (
    <div>
      <Typography variant="h2">Design information</Typography>

      {derivedFrom.trim() && (
        <Typography
          variant="body1"
          sx={{mt: 1}}
          data-testid="derived-from-info"
        >
          This {config.notebookName} is derived from <i>{derivedFrom}</i>. Some
          fields may be protected.
        </Typography>
      )}

      <Card variant="outlined" sx={{mt: 2}}>
        <Grid container spacing={3} sx={{p: 3}}>
          <Grid size={12}>
            <Typography variant="h6">Settings</Typography>
            <Typography variant="body2" color="text.secondary" sx={{mb: 1}}>
              Functional options that affect how the mobile app behaves for this
              design.
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={settings.showQrCodeButton}
                  onChange={e =>
                    dispatch(
                      settingsUpdated({showQrCodeButton: e.target.checked})
                    )
                  }
                />
              }
              label="Enable QR code search of records"
            />
            <FormHelperText>
              Useful if your form includes a QR code field.
            </FormHelperText>
          </Grid>

          <Grid size={12}>
            <Divider />
          </Grid>

          <Grid size={12}>
            <Typography variant="h6">Notebook information</Typography>
            <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
              Optional details about this {config.notebookName}, such as who
              leads the project. Edit the title and description in Control
              Centre.
            </Typography>
          </Grid>

          <Grid container size={12} spacing={2.5}>
            <Grid size={{xs: 12, sm: 4}}>
              <DebouncedTextField
                fullWidth
                label="Project lead (label)"
                name="projectLeadLabel"
                value={information.projectLeadLabel}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  dispatch(
                    informationUpdated({projectLeadLabel: event.target.value})
                  );
                }}
              />
            </Grid>

            <Grid size={{xs: 12, sm: 4}}>
              <DebouncedTextField
                fullWidth
                label="Lead institution"
                name="leadInstitution"
                value={information.leadInstitution}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  dispatch(
                    informationUpdated({leadInstitution: event.target.value})
                  );
                }}
              />
            </Grid>

            <Grid size={{xs: 12, sm: 4}}>
              <DebouncedTextField
                fullWidth
                label={`${config.notebookNameCapitalized} version`}
                name="notebookVersion"
                value={information.notebookVersion}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  dispatch(
                    informationUpdated({notebookVersion: event.target.value})
                  );
                }}
              />
              <FormHelperText>
                Use this field to differentiate between versions of this{' '}
                {config.notebookName}; e.g. 1.0, 1.1 and so on.
              </FormHelperText>
            </Grid>
          </Grid>

          <Grid size={12}>
            <MdxEditor
              initialMarkdown={information.purposeMarkdown}
              editorRef={purposeRef}
              handleChange={() =>
                dispatch(
                  informationUpdated({
                    purposeMarkdown:
                      purposeRef.current?.getMarkdown() as string,
                  })
                )
              }
            />
            <FormHelperText>
              Design purpose and scope (former pre-description). If you use
              source mode, put blank lines before and after markdown syntax for
              compatibility.
            </FormHelperText>
          </Grid>

          <Grid size={12}>
            <Divider sx={{my: 1}} />
            <Typography variant="subtitle1" sx={{mb: 1}}>
              Custom metadata
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
              Optional organisation-specific fields stored under{' '}
              <code>metadata.custom</code>.
            </Typography>
          </Grid>

          <Grid container size={12} spacing={2.5}>
            <Grid size={{xs: 12, sm: 5}}>
              <form
                onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                  e.preventDefault();
                  addCustomField();
                }}
              >
                <DebouncedTextField
                  fullWidth
                  label="Custom field name"
                  name="custom_field_name"
                  size="small"
                  value={customFieldName}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setCustomFieldName(event.target.value)
                  }
                />
                <DebouncedTextField
                  fullWidth
                  sx={{mt: 1.5}}
                  label="Custom field value"
                  name="custom_field_value"
                  size="small"
                  value={customFieldValue}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setCustomFieldValue(event.target.value)
                  }
                />
                <Button
                  sx={{mt: 2.5}}
                  variant="contained"
                  color="primary"
                  type="submit"
                >
                  Add custom field
                </Button>
                {alert && (
                  <Alert
                    onClose={() => setAlert('')}
                    severity="error"
                    sx={{mt: 2.5}}
                  >
                    {alert}
                  </Alert>
                )}
              </form>
            </Grid>

            <Grid container size={{xs: 12, sm: 7}} sx={{rowGap: 1}}>
              {Object.keys(custom).map(key => (
                <Grid size={12} key={key}>
                  <DebouncedTextField
                    fullWidth
                    label={key}
                    name={key}
                    data-testid={'custom-field-' + key}
                    value={String(custom[key] ?? '')}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                      dispatch(
                        customFieldUpdated({key, value: event.target.value})
                      );
                    }}
                  />
                  <Button
                    size="small"
                    color="secondary"
                    sx={{mt: 0.5}}
                    onClick={() => dispatch(customFieldRemoved({key}))}
                  >
                    Remove
                  </Button>
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      </Card>
    </div>
  );
};
