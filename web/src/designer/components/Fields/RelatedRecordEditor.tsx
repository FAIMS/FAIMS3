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

import {
  Grid,
  Card,
  FormHelperText,
  FormControl,
  FormControlLabel,
  Checkbox,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  List,
  ListItem,
  IconButton,
  Button,
  ListItemText,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleIcon from '@mui/icons-material/AddCircle';

import {useState} from 'react';
import {useAppSelector, useAppDispatch} from '../../state/hooks';
import {BaseFieldEditor} from './BaseFieldEditor';
import {FieldType} from '../../state/initial';
import DebouncedTextField from '../debounced-text-field';

type PairList = [string, string][];

type Props = {
  fieldName: string;
};

type RelatedRecordConfig = {
  multiple: boolean;
  relatedType: string;
  relatedTypeLabel: string;
  relationType: string;
  relationLinkedPair: PairList;
  allowLinkToExisting: boolean;
  showCreateAnotherButton: boolean;
};

export const RelatedRecordEditor = ({fieldName}: Props) => {
  const field = useAppSelector(
    state => state.notebook['ui-specification'].present.fields[fieldName]
  );
  const viewsets = useAppSelector(
    state => state.notebook['ui-specification'].present.viewsets
  );
  const dispatch = useAppDispatch();

  const [newOption1, setNewOption1] = useState('');
  const [newOption2, setNewOption2] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const viewsetEntries = Object.entries(viewsets);

  const componentParams = field['component-parameters'];

  const getLinkedPairs = (): PairList => {
    return componentParams.relation_linked_vocabPair ?? [];
  };

  const pairs = getLinkedPairs();

  const state: RelatedRecordConfig = {
    multiple: (componentParams.multiple as boolean) ?? false,
    relatedType: (componentParams.related_type as string) ?? '',
    relatedTypeLabel: (componentParams.related_type_label as string) ?? '',
    relationType: (componentParams.relation_type as string) ?? '',
    relationLinkedPair: (componentParams.relation_linked_vocabPair as PairList) ?? [],
    allowLinkToExisting: (componentParams.allowLinkToExisting as boolean) ?? false,
    showCreateAnotherButton: (componentParams.showCreateAnotherButton as boolean) ?? false,
  };

  const updateField = (name: string, newField: FieldType) => {
    dispatch({
      type: 'ui-specification/fieldUpdated',
      payload: {fieldName: name, newField},
    });
  };

  const updateFieldFromState = (newState: RelatedRecordConfig) => {
    const newField: FieldType = JSON.parse(JSON.stringify(field));

    newField['component-parameters'].multiple = newState.multiple;
    newField['component-parameters'].related_type = newState.relatedType;
    newField['component-parameters'].related_type_label = newState.relatedTypeLabel;
    newField['component-parameters'].relation_type = newState.relationType;
    newField['component-parameters'].relation_linked_vocabPair = newState.relationLinkedPair;
    newField['component-parameters'].allowLinkToExisting = newState.allowLinkToExisting;
    newField['component-parameters'].showCreateAnotherButton = newState.showCreateAnotherButton;

    updateField(fieldName, newField);
  };

  const updateProperty = (
    prop: keyof RelatedRecordConfig,
    value: string | boolean | PairList
  ) => {
    if (prop === 'relatedType') {
      const matchingEntry = viewsetEntries.find(([key]) => key === value);
      if (matchingEntry) {
        const newState: RelatedRecordConfig = {
          ...state,
          relatedType: value as string,
          relatedTypeLabel: matchingEntry[1].label,
        };
        updateFieldFromState(newState);
      }
    } else {
      const newState: RelatedRecordConfig = {...state, [prop]: value};
      updateFieldFromState(newState);
    }
  };

  const addPair = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmedOption1 = newOption1.trim();
    const trimmedOption2 = newOption2.trim();

    if (trimmedOption1.length === 0 || trimmedOption2.length === 0) {
      setErrorMessage('Cannot add an empty option!');
      return;
    }

    // Check for duplicate pairs
    const isDuplicate = pairs.some(
      ([first, second]) => first === trimmedOption1 && second === trimmedOption2
    );

    if (isDuplicate) {
      setErrorMessage('This pair already exists!');
      return;
    }

    const newPairs: PairList = [...pairs, [trimmedOption1, trimmedOption2]];
    updateProperty('relationLinkedPair', newPairs);
    setErrorMessage('');
    setNewOption1('');
    setNewOption2('');
  };

  const removePair = (pairToRemove: string[]) => {
    const newPairs = pairs.filter(
      pair =>
        pair.length !== pairToRemove.length ||
        !pairToRemove.every((item, index) => item === pair[index])
    );
    updateProperty('relationLinkedPair', newPairs);
  };

  return (
    <BaseFieldEditor fieldName={fieldName}>
      <Grid item xs={12}>
        <Card variant="outlined">
          <Grid container p={2} rowSpacing={3}>
            <Grid item xs={12} sm={3}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={state.multiple}
                    onChange={e => updateProperty('multiple', e.target.checked)}
                  />
                }
                label="Multiple"
              />
              <FormHelperText>
                Tick if user can add multiple records for this relationship.
              </FormHelperText>
            </Grid>

            <Grid item xs={12} sm={3}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={state.allowLinkToExisting}
                    onChange={e =>
                      updateProperty('allowLinkToExisting', e.target.checked)
                    }
                  />
                }
                label="Allow linking to existing records"
              />
              <FormHelperText>
                If <b>checked</b>, users can use this field to link to existing
                records of this type. If <b>un-checked</b>, users can only
                create new records to link to.
              </FormHelperText>
            </Grid>

            <Grid item xs={12} sm={3}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={state.showCreateAnotherButton}
                    onChange={e =>
                      updateProperty('showCreateAnotherButton', e.target.checked)
                    }
                  />
                }
                label="Show 'Create Another' button"
              />
              <FormHelperText>
                If <b>checked</b>, displays a button allowing users to quickly
                create another related record after saving one.
              </FormHelperText>
            </Grid>

            <Grid item xs={12} sm={3}>
              <FormControl required sx={{minWidth: 150}}>
                <InputLabel id="relationType-label">
                  Select Relation Type
                </InputLabel>
                <Select
                  labelId="relationType-label"
                  label="Select Relation Type *"
                  value={state.relationType}
                  onChange={e => updateProperty('relationType', e.target.value)}
                >
                  <MenuItem value="faims-core::Child">Child</MenuItem>
                  <MenuItem value="faims-core::Linked">Linked</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={3}>
              <FormControl required sx={{minWidth: 150}}>
                <InputLabel id="relatedType-label">
                  Select Related Form
                </InputLabel>
                <Select
                  labelId="relatedType-label"
                  label="Select Related Form *"
                  value={state.relatedType}
                  onChange={e => updateProperty('relatedType', e.target.value)}
                >
                  {viewsetEntries.map(([key, viewset]) => (
                    <MenuItem key={key} value={key}>
                      {viewset.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={3}>
              <FormControl required sx={{minWidth: 150}}>
                <DebouncedTextField
                  name="related-type-label"
                  variant="outlined"
                  label="Related Type Label"
                  value={state.relatedTypeLabel}
                  onChange={e =>
                    updateProperty('relatedTypeLabel', e.target.value)
                  }
                  helperText="Label for the other type."
                />
              </FormControl>
            </Grid>
          </Grid>
        </Card>
      </Grid>

      {state.relationType === 'faims-core::Linked' && (
        <Grid item xs={12}>
          <Card variant="outlined" sx={{display: 'flex'}}>
            <Grid container p={2} columnSpacing={3} rowSpacing={3}>
              <Grid item xs={12} sm={6}>
                <Alert severity="info">
                  Add and remove Linking Pairs as needed.
                </Alert>
                <form onSubmit={addPair}>
                  <Grid
                    container
                    item
                    style={{display: 'flex'}}
                    direction={{xs: 'column', sm: 'row'}}
                  >
                    <DebouncedTextField
                      label="Performed Before"
                      value={newOption1}
                      onChange={e => setNewOption1(e.target.value)}
                      sx={{my: 1.5}}
                    />
                    <DebouncedTextField
                      label="Performed After"
                      value={newOption2}
                      onChange={e => setNewOption2(e.target.value)}
                      sx={{my: 1.5}}
                    />
                    <Button
                      color="primary"
                      startIcon={<AddCircleIcon />}
                      variant="outlined"
                      type="submit"
                      sx={{my: 1.5}}
                    >
                      ADD
                    </Button>
                  </Grid>
                </form>
                {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
              </Grid>
              <Grid item xs={12} sm={6}>
                <List>
                  {pairs.map((pair, index) => (
                    <ListItem
                      key={index}
                      secondaryAction={
                        <IconButton
                          edge="end"
                          aria-label="delete"
                          onClick={() => removePair(pair)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      }
                    >
                      {pair.map((item, itemIndex) => (
                        <ListItemText key={itemIndex} primary={item} />
                      ))}
                    </ListItem>
                  ))}
                </List>
              </Grid>
            </Grid>
          </Card>
        </Grid>
      )}
    </BaseFieldEditor>
  );
};
