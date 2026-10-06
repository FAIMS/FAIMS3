// SPDX-License-Identifier: Apache-2.0
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
 * @file Setup form editor for templates: add/edit/remove/reorder the
 * metadata fields presented when a notebook is created from the template.
 * Hidden outside template mode. Writes to uiSpec.settings.setupForm (#2216).
 */

import {useState} from 'react';
import {
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import {shallowEqual} from 'react-redux';
import type {SetupField} from '@faims3/data-model';
import {useAppDispatch, useAppSelector} from '../state/hooks';
import {selectDesignerMode} from '../store/selectors';
import {settingsUpdated} from '../store/slices/uiSpec';
import {
  designerCancelButtonSx,
  designerDialogActionsSx,
  designerDialogTitleSx,
  designerPrimaryActionButtonSx,
} from './designer-style';

const FIELD_TYPES: {value: SetupField['type']; label: string}[] = [
  {value: 'string', label: 'Text'},
  {value: 'longtext', label: 'Long text'},
  {value: 'number', label: 'Number'},
  {value: 'date', label: 'Date'},
  {value: 'select', label: 'Single select'},
  {value: 'multiselect', label: 'Multi select'},
];
/** Derive a camelCase storage key from a display label. */
const nameFromLabel = (label: string) =>
  label
    .trim()
    .split(/\s+/)
    .map((word, i) => {
      const lower = word.toLowerCase().replace(/[^a-z0-9]/g, '');
      return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');

const needsOptions = (type: SetupField['type']) =>
  type === 'select' || type === 'multiselect';

/** Add/edit dialog for a single setup field. */
const FieldDialog = ({
  open,
  initial,
  takenNames,
  onSave,
  onClose,
}: {
  open: boolean;
  initial?: SetupField;
  takenNames: string[];
  onSave: (field: SetupField) => void;
  onClose: () => void;
}) => {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  // stop auto-deriving the name once the user edits it directly
  const [nameTouched, setNameTouched] = useState(Boolean(initial));
  const [type, setType] = useState<SetupField['type']>(
    initial?.type ?? 'string'
  );
  const [required, setRequired] = useState(initial?.required ?? false);
  const [helperText, setHelperText] = useState(initial?.helperText ?? '');
  const [optionsText, setOptionsText] = useState(
    initial?.options?.join('\n') ?? ''
  );

  const options = optionsText
    .split('\n')
    .map(o => o.trim())
    .filter(o => o.length > 0);

  const nameClash = takenNames.includes(name.trim());
  const optionsMissing = needsOptions(type) && options.length === 0;
  const canSave =
    label.trim().length > 0 &&
    name.trim().length > 0 &&
    !nameClash &&
    !optionsMissing;

  const handleSave = () => {
    const field: SetupField = {
      name: name.trim(),
      label: label.trim(),
      type,
      ...(required ? {required: true} : {}),
      ...(helperText.trim() ? {helperText: helperText.trim()} : {}),
      ...(needsOptions(type) ? {options} : {}),
    };
    onSave(field);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={designerDialogTitleSx}>
        {initial ? 'Edit Field' : 'Add Field'}
      </DialogTitle>
      <DialogContent
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          pt: '12px !important',
        }}
      >
        <TextField
          label="Label"
          value={label}
          onChange={e => {
            setLabel(e.target.value);
            if (!nameTouched) setName(nameFromLabel(e.target.value));
          }}
          required
          autoFocus
          fullWidth
          helperText="Shown to the user on the creation form"
        />
        <TextField
          label="Name"
          value={name}
          onChange={e => {
            setName(e.target.value);
            setNameTouched(true);
          }}
          required
          fullWidth
          error={nameClash}
          helperText={
            nameClash
              ? 'Another field already uses this name'
              : 'Key the value is stored under in the notebook metadata'
          }
        />
        <TextField
          select
          label="Type"
          value={type}
          onChange={e => setType(e.target.value as SetupField['type'])}
          fullWidth
          helperText="How the value is entered on the creation form"
        >
          {FIELD_TYPES.map(t => (
            <MenuItem key={t.value} value={t.value}>
              {t.label}
            </MenuItem>
          ))}
        </TextField>
        {needsOptions(type) && (
          <TextField
            label="Options"
            value={optionsText}
            onChange={e => setOptionsText(e.target.value)}
            required
            multiline
            minRows={3}
            fullWidth
            error={optionsMissing && optionsText.length > 0}
            helperText="One option per line"
          />
        )}
        <TextField
          label="Helper text (optional)"
          value={helperText}
          onChange={e => setHelperText(e.target.value)}
          fullWidth
          helperText="Shown under the field on the creation form to explain what to enter"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={required}
              onChange={e => setRequired(e.target.checked)}
            />
          }
          label="Required"
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{display: 'block', mt: -1.5, ml: 4}}
        >
          The notebook cannot be created until this field is filled in
        </Typography>
      </DialogContent>
      <DialogActions sx={designerDialogActionsSx}>
        <Button onClick={onClose} sx={designerCancelButtonSx}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!canSave}
          sx={designerPrimaryActionButtonSx}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/** Setup form field list with add/edit/remove/reorder; template mode only. */
export const SetupFormPanel = () => {
  const dispatch = useAppDispatch();
  const mode = useAppSelector(selectDesignerMode);
  const setupForm = useAppSelector(
    state => state.notebook.uiSpec.present.settings.setupForm,
    shallowEqual
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  if (mode !== 'template') {
    return null;
  }

  const fields = setupForm?.fields ?? [];

  // removing the last field removes the form entirely (empty fields is invalid)
  const commit = (next: SetupField[]) => {
    dispatch(
      settingsUpdated({
        setupForm: next.length > 0 ? {fields: next} : undefined,
      })
    );
  };

  const handleSave = (field: SetupField) => {
    const next = [...fields];
    if (editIndex !== null) {
      next[editIndex] = field;
    } else {
      next.push(field);
    }
    commit(next);
    setDialogOpen(false);
    setEditIndex(null);
  };

  const handleDelete = (index: number) => {
    commit(fields.filter((_, i) => i !== index));
    setDeleteIndex(null);
  };

  const move = (index: number, delta: -1 | 1) => {
    const next = [...fields];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    commit(next);
  };

  const takenNames = fields.filter((_, i) => i !== editIndex).map(f => f.name);

  const typeLabel = (type: SetupField['type']) =>
    FIELD_TYPES.find(t => t.value === type)?.label ?? type;

  return (
    <div>
      <Typography variant="h2">Setup form</Typography>

      <Card variant="outlined" sx={{mt: 2}}>
        <Box sx={{p: 3}}>
          <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
            Fields presented when a notebook is created from this template.
            Values are stored in the notebook's metadata. Fields appear in the
            order listed here.
          </Typography>

          {fields.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
              No Setup form is defined. Add a field to create one.
            </Typography>
          )}

          {fields.map((field, index) => (
            <Card key={field.name} variant="outlined" sx={{mb: 1, p: 1.5}}>
              <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                <Box sx={{flexGrow: 1, minWidth: 0}}>
                  <Typography variant="subtitle2" noWrap>
                    {field.label}
                    {field.required ? ' *' : ''}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {field.name} — {typeLabel(field.type)}
                    {field.options ? `: ${field.options.join(', ')}` : ''}
                  </Typography>
                </Box>
                <Chip size="small" label={typeLabel(field.type)} />
                <Tooltip title="Move up">
                  <span>
                    <IconButton
                      size="small"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUpwardRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Move down">
                  <span>
                    <IconButton
                      size="small"
                      disabled={index === fields.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDownwardRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Edit">
                  <IconButton
                    size="small"
                    onClick={() => {
                      setEditIndex(index);
                      setDialogOpen(true);
                    }}
                  >
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Remove">
                  <IconButton
                    size="small"
                    onClick={() => setDeleteIndex(index)}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Card>
          ))}

          <Button
            startIcon={<AddRoundedIcon />}
            onClick={() => {
              setEditIndex(null);
              setDialogOpen(true);
            }}
            sx={{mt: 1}}
          >
            Add Field
          </Button>
        </Box>
      </Card>

      {dialogOpen && (
        <FieldDialog
          open={dialogOpen}
          initial={editIndex !== null ? fields[editIndex] : undefined}
          takenNames={takenNames}
          onSave={handleSave}
          onClose={() => {
            setDialogOpen(false);
            setEditIndex(null);
          }}
        />
      )}

      <Dialog open={deleteIndex !== null} onClose={() => setDeleteIndex(null)}>
        <DialogTitle sx={designerDialogTitleSx}>Remove field?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Remove '{deleteIndex !== null ? fields[deleteIndex]?.label : ''}'
            from the Setup form?
          </Typography>
        </DialogContent>
        <DialogActions sx={designerDialogActionsSx}>
          <Button
            onClick={() => setDeleteIndex(null)}
            sx={designerCancelButtonSx}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteIndex !== null && handleDelete(deleteIndex)}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};
