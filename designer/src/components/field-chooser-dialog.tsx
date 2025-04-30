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

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Tabs,
  Tab,
  TextField,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  Typography,
  useTheme,
} from '@mui/material';

import TextFieldsRoundedIcon from '@mui/icons-material/TextFieldsRounded';
import LooksOneRoundedIcon from '@mui/icons-material/LooksOneRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import InsertPhotoRoundedIcon from '@mui/icons-material/InsertPhotoRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import RemoveRedEyeRoundedIcon from '@mui/icons-material/RemoveRedEyeRounded';
import ViewModuleRoundedIcon from '@mui/icons-material/ViewModuleRounded';

import {useEffect, useMemo, useState} from 'react';
import {getFieldNames, getFieldSpec} from '../fields';
import DebouncedTextField from './debounced-text-field';

type FieldChooserDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (fieldName: string, fieldType: string) => void;
};

type FieldOption = {
  key: string;
  label: string;
  description: string;
  category: string;
};

const CATEGORY_ICONS: {[k: string]: React.ReactElement} = {
  All: <ViewModuleRoundedIcon />,
  Text: <TextFieldsRoundedIcon />,
  Numbers: <LooksOneRoundedIcon />,
  'Date & Time': <CalendarMonthRoundedIcon />,
  Media: <InsertPhotoRoundedIcon />,
  Location: <PlaceRoundedIcon />,
  Choice: <ListAltRoundedIcon />,
  Relationship: <ShareRoundedIcon />,
  Display: <RemoveRedEyeRoundedIcon />,
};

const CARD_HEIGHT = 70;

export default function FieldChooserDialog({
  open,
  onClose,
  onConfirm,
}: FieldChooserDialogProps) {
  const theme = useTheme();

  const allOptions: FieldOption[] = useMemo(
    () =>
      getFieldNames().map(key => {
        const spec = getFieldSpec(key);
        return {
          key,
          label: spec.displayLabel || spec['component-name'],
          description:
            spec['component-parameters']?.advancedHelperText?.toString() || '',
          category: spec.category || 'Uncategorised',
        };
      }),
    []
  );

  const categoryTabs = useMemo(() => {
    const cats = Array.from(new Set(allOptions.map(o => o.category))).sort();
    return ['All', ...cats];
  }, [allOptions]);

  const [fieldName, setFieldName] = useState('New Field');
  const [category, setCategory] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFieldName('New Field');
      setCategory('All');
      setSearch('');
      setSelected(null);
    }
  }, [open]);

  const filtered = useMemo(() => {
    return allOptions
      .filter(o => category === 'All' || o.category === category)
      .filter(o => {
        if (!search.trim()) return true;
        const needle = search.toLowerCase();
        return (
          o.label.toLowerCase().includes(needle) ||
          o.description.toLowerCase().includes(needle)
        );
      });
  }, [allOptions, category, search]);

  const handleConfirm = () => {
    if (selected) onConfirm(fieldName.trim() || 'New Field', selected);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      scroll="paper"
    >
      <DialogTitle>Select a Field Type</DialogTitle>

      <DialogContent dividers sx={{pt: 2, pb: 2}}>
        <DebouncedTextField
          label="Field name"
          fullWidth
          variant="standard"
          margin="dense"
          value={fieldName}
          onChange={e => setFieldName(e.target.value)}
          autoFocus
        />

        <Tabs
          value={category}
          onChange={(_, v: string) => setCategory(v)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{mt: 2, mb: 2}}
        >
          {categoryTabs.map(tab => (
            <Tab
              key={tab}
              value={tab}
              icon={CATEGORY_ICONS[tab] ?? <ViewModuleRoundedIcon />}
              label={tab}
              iconPosition="start"
            />
          ))}
        </Tabs>

        <TextField
          placeholder="Search field types"
          fullWidth
          variant="outlined"
          size="small"
          sx={{mb: 2}}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <Grid
          container
          spacing={2}
          sx={{
            maxHeight: '50vh',
            overflowY: 'auto',
            pr: 1,
            pb: 2,
            mt: 2,
          }}
        >
          {filtered.map(opt => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={opt.key}>
              <Card
                variant="outlined"
                sx={{
                  height: CARD_HEIGHT,
                  borderWidth: 2,
                  borderColor:
                    selected === opt.key
                      ? theme.palette.primary.main
                      : 'transparent',
                  boxShadow: theme.shadows[1],
                  transition: theme.transitions.create(
                    ['border-color', 'box-shadow'],
                    {duration: theme.transitions.duration.short}
                  ),
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <CardActionArea
                  sx={{flexGrow: 1}}
                  onClick={() => setSelected(opt.key)}
                  onDoubleClick={() => {
                    setSelected(opt.key);
                    handleConfirm();
                  }}
                >
                  <CardContent
                    sx={{
                      height: '100%',
                      p: 1.25,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{minHeight: 24}}
                    >
                      {CATEGORY_ICONS[opt.category] ?? (
                        /* FIX: defensive default */
                        <ViewModuleRoundedIcon />
                      )}
                      <Typography variant="subtitle2">{opt.label}</Typography>
                    </Stack>

                    {opt.description && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                      >
                        {opt.description}
                      </Typography>
                    )}
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}

          {filtered.length === 0 && (
            <Grid item xs={12}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{mt: 4, textAlign: 'center'}}
              >
                No field types match your search
              </Typography>
            </Grid>
          )}
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleConfirm}
          disabled={!selected}
          variant="contained"
        >
          Add Field
        </Button>
      </DialogActions>
    </Dialog>
  );
}
