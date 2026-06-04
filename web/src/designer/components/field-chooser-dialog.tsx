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
 * @file Categorized grid of field templates for the add-field flow.
 */

import {useEffect, useMemo, useRef, useState} from 'react';
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
  InputAdornment,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  Typography,
  useTheme,
  Box,
  Tooltip,
  Chip,
} from '@mui/material';
import {alpha} from '@mui/material/styles';
import ViewModuleRoundedIcon from '@mui/icons-material/ViewModuleRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {designerDialogActionsSx, designerDialogTitleSx} from './designer-style';

import {getFieldNames, getFieldSpec} from '../fields';
import {
  ALL_CATEGORIES,
  CategoryConfigMap,
  CategoryKey,
} from '../field-categories';

type FieldChooserDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (fieldType: string) => void;
};

type FieldOption = {
  key: string;
  label: string;
  description: string;
  category: CategoryKey;
  order: number;
  showInChooser: boolean;
  deprecated: boolean;
  deprecationMessage: string;
};

const CARD_HEIGHT = 80;

/** Modal to pick a field template type and add it to a section in one click. */
export default function FieldChooserDialog({
  open,
  onClose,
  onConfirm,
}: FieldChooserDialogProps) {
  const theme = useTheme();

  const [tooltipOpenKey, setTooltipOpenKey] = useState<string | false>(false);
  const [category, setCategory] = useState<CategoryKey>(CategoryKey.ALL);
  const [search, setSearch] = useState('');
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const [showTabsScrollHint, setShowTabsScrollHint] = useState(false);

  useEffect(() => {
    if (open) {
      setCategory(CategoryKey.ALL);
      setSearch('');
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
            deprecated: spec.deprecated === true,
            deprecationMessage: spec.deprecationMessage || '',
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

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const scroller = el.querySelector(
      '.MuiTabs-scroller'
    ) as HTMLElement | null;
    if (!scroller) return;

    const evaluate = () => {
      setShowTabsScrollHint(scroller.scrollWidth > scroller.clientWidth + 4);
    };

    evaluate();
    window.addEventListener('resize', evaluate);
    return () => window.removeEventListener('resize', evaluate);
  }, [open, categoryTabs.length]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      sx={{
        '& .MuiDialog-paper': {
          maxHeight: '75vh',
          borderRadius: 2,
          borderTop: `6px solid ${theme.palette.secondary.main}`,
          backgroundImage: `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${theme.palette.grey[50]} 100%)`,
        },
      }}
    >
      <DialogTitle sx={designerDialogTitleSx}>Add a field</DialogTitle>

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
        <Box sx={{maxWidth: 1120, width: '100%', mx: 'auto'}}>
          <Tabs
            ref={tabsRef}
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
              '& .MuiTab-root': {
                borderRadius: 999,
                minHeight: 36,
                minWidth: 'fit-content',
                px: 1.5,
                textTransform: 'none',
                fontWeight: 600,
                color: 'text.secondary',
                '& .MuiSvgIcon-root': {color: 'inherit'},
              },
              '& .MuiTab-root.Mui-selected': {
                bgcolor: 'primary.main',
                color: 'common.white',
              },
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
          {showTabsScrollHint && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{display: 'block', mb: 1.2}}
            >
              Scroll left/right to view all field categories.
            </Typography>
          )}

          <TextField
            placeholder="Search field types"
            fullWidth
            variant="outlined"
            size="small"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon
                      sx={{
                        color: 'text.secondary',
                        fontSize: '1.35rem',
                        strokeWidth: 1.8,
                        filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.18))',
                      }}
                    />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              mb: 2,
              flexShrink: 0,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                bgcolor: theme.palette.common.white,
                boxShadow:
                  '0 2px 8px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
                transition: theme.transitions.create(
                  ['box-shadow', 'border-color', 'background-color'],
                  {duration: theme.transitions.duration.shorter}
                ),
                '&:hover': {
                  boxShadow:
                    '0 4px 12px rgba(15, 23, 42, 0.1), inset 0 1px 0 rgba(255,255,255,0.85)',
                },
                '&.Mui-focused': {
                  boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.14)}, 0 6px 14px rgba(15, 23, 42, 0.12)`,
                },
              },
              '& .MuiOutlinedInput-input::placeholder': {
                color: 'text.secondary',
                opacity: 0.82,
              },
            }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{...theme.typography.body2, mb: 1.75, display: 'block'}}
          >
            Click any field card to add it instantly, then name it in the field
            editor.
          </Typography>
        </Box>

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
              <Grid size={{xs: 12, sm: 6, md: 4, lg: 3}} key={opt.key}>
                <Tooltip
                  title={
                    opt.deprecated && opt.deprecationMessage
                      ? `${opt.description} ${opt.deprecationMessage}`.trim()
                      : opt.description
                  }
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
                      borderWidth: 1,
                      borderColor: theme =>
                        alpha(theme.palette.text.primary, 0.15),
                      background: theme =>
                        `linear-gradient(180deg, ${alpha(
                          theme.palette.background.paper,
                          0.96
                        )} 0%, ${alpha(theme.palette.text.primary, 0.035)} 100%)`,
                      boxShadow: '0 3px 8px rgba(15, 23, 42, 0.08)',
                      transition: theme.transitions.create(
                        ['border-color', 'box-shadow', 'transform'],
                        {duration: theme.transitions.duration.short}
                      ),
                      display: 'flex',
                      flexDirection: 'column',
                      '&:hover': {
                        borderColor: theme =>
                          alpha(theme.palette.primary.main, 0.35),
                        boxShadow: '0 8px 18px rgba(15, 23, 42, 0.12)',
                        transform: 'translateY(-1px)',
                      },
                    }}
                  >
                    <CardActionArea
                      sx={{flexGrow: 1}}
                      onClick={() => onConfirm(opt.key)}
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
                          sx={{minHeight: 24, alignItems: 'center'}}
                        >
                          {CategoryConfigMap[opt.category]?.icon ?? (
                            <ViewModuleRoundedIcon />
                          )}
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontWeight: 700,
                              color: 'text.primary',
                              display: '-webkit-box',
                              overflow: 'hidden',
                              WebkitBoxOrient: 'vertical',
                              WebkitLineClamp: 2,
                            }}
                          >
                            {opt.label}
                          </Typography>
                        </Stack>
                        {opt.deprecated && (
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'flex-end',
                              mt: 0.85,
                            }}
                          >
                            <Chip
                              size="small"
                              icon={<WarningAmberRoundedIcon />}
                              label="Deprecated"
                              sx={{
                                height: 22,
                                fontWeight: 800,
                                borderRadius: '4px 10px 10px 4px',
                                bgcolor: '#F4C542',
                                color: '#111111',
                                border: '1px solid',
                                borderColor: '#C79A1D',
                                '& .MuiChip-icon': {
                                  color: 'inherit',
                                },
                              }}
                            />
                          </Box>
                        )}
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Tooltip>
              </Grid>
            ))}

            {filtered.length === 0 && (
              <Grid size={12}>
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

      <DialogActions sx={designerDialogActionsSx}>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            bgcolor: theme.palette.secondary.main,
            '&:hover': {bgcolor: theme.palette.secondary.dark},
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
