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

import {useEffect, useMemo, useState} from 'react';
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
  Box,
  Tooltip,
} from '@mui/material';
import ViewModuleRoundedIcon from '@mui/icons-material/ViewModuleRounded';

import {getFieldNames, getFieldSpec} from '../fields';
import {
  ALL_CATEGORIES,
  CategoryConfigMap,
  CategoryKey,
} from '../field-categories';

type FieldChooserDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (fieldName: string, fieldType: string) => void;
};

type FieldOption = {
  key: string;
  label: string;
  description: string;
  category: CategoryKey;
  order: number;
  showInChooser: boolean;
};

const CARD_HEIGHT = 80;

export default function FieldChooserDialog({
  open,
  onClose,
  onConfirm,
}: FieldChooserDialogProps) {
  const theme = useTheme();

  const [tooltipOpenKey, setTooltipOpenKey] = useState<string | false>(false);
  const [fieldName, setFieldName] = useState('New Field');
  const [category, setCategory] = useState<CategoryKey>(CategoryKey.ALL);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFieldName('New Field');
      setCategory(CategoryKey.ALL);
      setSearch('');
      setSelected(null);
      setTooltipOpenKey(false);
    }
  }, [open]);

  const allOptions: FieldOption[] = useMemo(
    () =>
      getFieldNames()
        .map(key => {
          const spec = getFieldSpec(key);
          return {
            key,
            label: spec.humanReadableName || spec['component-name'],
            description: spec.humanReadableDescription || '',
            category: (spec.category as CategoryKey) || CategoryKey.ALL,
            order: spec.order ?? Number.MAX_SAFE_INTEGER,
            showInChooser: spec.showInChooser !== false,
          };
        })
        .filter(o => o.showInChooser)
        .sort((a, b) => a.order - b.order),
    []
  );

  const categoryTabs = ALL_CATEGORIES;

  const filtered = useMemo(() => {
    return allOptions
      .filter(o => category === CategoryKey.ALL || o.category === category)
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
    if (selected) {
      onConfirm(fieldName.trim() || 'New Field', selected);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      sx={{
        '& .MuiDialog-paper': {
          maxHeight: '75vh',
        },
      }}
    >
      <DialogTitle>Add a field</DialogTitle>

      <DialogContent
        dividers
        sx={{
          display: 'flex',
          flexDirection: 'column',
          px: 3,
          pt: 2,
          pb: 0,
        }}
      >
        <TextField
          label="Field name"
          fullWidth
          variant="outlined"
          value={fieldName}
          onChange={e => setFieldName(e.target.value)}
          sx={{mb: 2, flexShrink: 0}}
          autoFocus
        />

        <Tabs
          value={category}
          onChange={(_, v: CategoryKey) => setCategory(v)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{
            mb: 2,
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            bgcolor: theme.palette.background.paper,
            zIndex: 1,
          }}
        >
          {categoryTabs.map(key => (
            <Tab
              key={key}
              value={key}
              icon={CategoryConfigMap[key]?.icon ?? <ViewModuleRoundedIcon />}
              label={CategoryConfigMap[key]?.displayName ?? key}
              iconPosition="start"
            />
          ))}
        </Tabs>

        <TextField
          placeholder="Search field types"
          fullWidth
          variant="outlined"
          size="small"
          sx={{mb: 2, flexShrink: 0}}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            pr: 1,
            pb: 2,
          }}
          onScroll={() => {
            if (tooltipOpenKey) {
              setTooltipOpenKey(false);
            }
          }}
        >
          <Grid container spacing={2}>
            {filtered.map(opt => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={opt.key}>
                <Tooltip
                  title={opt.description}
                  arrow
                  placement="top-start"
                  disableHoverListener={!opt.description}
                  disableFocusListener={!opt.description}
                  disableTouchListener={!opt.description}
                  open={tooltipOpenKey === opt.key}
                  onOpen={() => {
                    if (opt.description) {
                      setTooltipOpenKey(opt.key);
                    }
                  }}
                  onClose={() => setTooltipOpenKey(false)}
                >
                  <Card
                    variant="outlined"
                    sx={{
                      minHeight: CARD_HEIGHT,
                      borderWidth: 2,
                      borderColor:
                        selected === opt.key
                          ? theme.palette.primary.main
                          : theme.palette.divider,
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
                          {CategoryConfigMap[opt.category]?.icon ?? (
                            <ViewModuleRoundedIcon />
                          )}
                          <Typography
                            variant="subtitle2"
                            sx={{
                              display: '-webkit-box',
                              overflow: 'hidden',
                              WebkitBoxOrient: 'vertical',
                              WebkitLineClamp: 2,
                            }}
                          >
                            {opt.label}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Tooltip>
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
        </Box>
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
