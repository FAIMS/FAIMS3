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
 * @file Plan template controls for the design panel: an Add Plan button in
 * template mode, a chooser for plan types, per-type authoring dialogs, and a
 * row per existing plan template carrying its label, order and removal.
 */

import {useState} from 'react';
import {
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {alpha} from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {shallowEqual} from 'react-redux';
import type {AuthoredPlanTemplate} from '@faims3/data-model';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {selectDesignerMode} from '../../store/selectors';
import {
  planTemplateAdded,
  planTemplateLabelled,
  planTemplateMoved,
  planTemplateRemoved,
  planTemplateSet,
} from '../../state/planTemplates-reducer';
import {config} from '../../buildconfig';
import {getDesignerPlanType, getDesignerPlanTypes} from '../../plans';
import {
  designerCancelButtonSx,
  designerDialogActionsSx,
  designerDialogTitleSx,
  designerPrimaryActionButtonSx,
} from '../designer-style';

/** Which plan template an authoring dialog is open against. */
type Editing = {planType: string; index?: number};

/** Add/edit/order/remove the template's plan templates; hidden outside template mode. */
export const PlanTemplateManager = () => {
  const theme = useTheme();
  const dispatch = useAppDispatch();

  const mode = useAppSelector(selectDesignerMode);
  const planTemplates = useAppSelector(
    state => state.notebook.planTemplates,
    shallowEqual
  );
  const uiSpec = useAppSelector(
    state => state.notebook.uiSpec.present,
    shallowEqual
  );
  const viewSets = uiSpec.viewsets;

  const [chooserOpen, setChooserOpen] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);

  // Plans are only authored on templates. When the feature flag is off, hide
  // Add Plan for templates without a plan; existing plans stay editable.
  if (mode !== 'template') {
    return null;
  }
  if (!config.enablePlansInDesigner && planTemplates.length === 0) {
    return null;
  }

  const EditorDialog = editing
    ? getDesignerPlanType(editing.planType)?.Dialog
    : undefined;

  const planTypes = getDesignerPlanTypes();

  const handleSave = (saved: AuthoredPlanTemplate) => {
    if (editing?.index === undefined) dispatch(planTemplateAdded(saved));
    else dispatch(planTemplateSet({index: editing.index, planTemplate: saved}));
    setEditing(null);
  };

  return (
    <>
      <Stack spacing={1} sx={{width: '100%'}}>
        {planTemplates.map((planTemplate, index) => {
          const definition = getDesignerPlanType(planTemplate.planType);
          const typeLabel = definition?.label ?? planTemplate.planType;
          const formType = planTemplate.formType as string | undefined;
          const formLabel = formType ? viewSets[formType]?.label : undefined;
          const formMissing = Boolean(formType && !formLabel);
          return (
            <Stack
              key={planTemplate.planId}
              direction="row"
              spacing={1}
              sx={{alignItems: 'center'}}
              data-testid="web-designer-plan-row"
            >
              {/* Array order is the order the app's plan chooser offers them in */}
              <Tooltip title="Move plan up">
                <span>
                  <IconButton
                    size="small"
                    aria-label="move plan up"
                    disabled={index === 0}
                    onClick={() =>
                      dispatch(planTemplateMoved({index, direction: 'up'}))
                    }
                  >
                    <ArrowUpwardRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Move plan down">
                <span>
                  <IconButton
                    size="small"
                    aria-label="move plan down"
                    disabled={index === planTemplates.length - 1}
                    onClick={() =>
                      dispatch(planTemplateMoved({index, direction: 'down'}))
                    }
                  >
                    <ArrowDownwardRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <TextField
                size="small"
                label="Label"
                placeholder={planTemplate.planId}
                helperText="Shown when choosing a plan"
                value={planTemplate.label ?? ''}
                onChange={event =>
                  dispatch(
                    planTemplateLabelled({index, label: event.target.value})
                  )
                }
              />
              <Chip
                icon={formMissing ? <WarningAmberRoundedIcon /> : undefined}
                label={
                  formMissing
                    ? `${typeLabel} plan: form missing`
                    : `${typeLabel} plan: ${formLabel}`
                }
                color={formMissing ? 'warning' : 'default'}
                onClick={() =>
                  setEditing({planType: planTemplate.planType, index})
                }
                sx={{fontWeight: 600}}
              />
              <Tooltip title="Edit plan">
                <IconButton
                  size="small"
                  aria-label="edit plan"
                  onClick={() =>
                    setEditing({planType: planTemplate.planType, index})
                  }
                >
                  <EditRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Remove plan">
                <IconButton
                  size="small"
                  aria-label="remove plan"
                  onClick={() => setRemoveIndex(index)}
                >
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          );
        })}

        {config.enablePlansInDesigner && (
          <Button
            variant="contained"
            size="small"
            startIcon={<AddRoundedIcon />}
            onClick={() => setChooserOpen(true)}
            data-testid="web-designer-add-plan-button"
            sx={{
              ...designerPrimaryActionButtonSx,
              alignSelf: 'flex-start',
              boxShadow: 'none',
              whiteSpace: 'nowrap',
              textTransform: 'none',
              fontWeight: 700,
            }}
          >
            Add Plan
          </Button>
        )}
      </Stack>

      {/* Plan type chooser */}
      <Dialog
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={designerDialogTitleSx}>Add a plan</DialogTitle>
        <DialogContent sx={{pt: 2}}>
          <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
            A plan guides data collection for notebooks created from this
            template. Choose a plan type.
          </Typography>
          <Grid container spacing={2}>
            {planTypes.map(plan => (
              <Grid size={{xs: 12}} key={plan.planType}>
                <Card
                  variant="outlined"
                  sx={{
                    borderColor: alpha(theme.palette.text.primary, 0.15),
                    '&:hover': {
                      borderColor: alpha(theme.palette.primary.main, 0.35),
                      boxShadow: '0 8px 18px rgba(15, 23, 42, 0.12)',
                    },
                  }}
                >
                  <CardActionArea
                    onClick={() => {
                      setChooserOpen(false);
                      setEditing({planType: plan.planType});
                    }}
                  >
                    <CardContent>
                      <Typography variant="subtitle2" sx={{fontWeight: 700}}>
                        {plan.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {plan.description}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions sx={designerDialogActionsSx}>
          <Button
            onClick={() => setChooserOpen(false)}
            sx={designerCancelButtonSx}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Per-type authoring dialog */}
      {EditorDialog && (
        <EditorDialog
          open={Boolean(editing)}
          uiSpec={uiSpec}
          initialTemplate={
            editing?.index === undefined
              ? undefined
              : planTemplates[editing.index]
          }
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      {/* Remove confirmation */}
      <Dialog open={removeIndex !== null} onClose={() => setRemoveIndex(null)}>
        <DialogTitle sx={designerDialogTitleSx}>Remove plan?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{mt: 1}}>
            Notebooks created from this template will no longer include this
            data collection plan.
          </Typography>
        </DialogContent>
        <DialogActions sx={designerDialogActionsSx}>
          <Button
            onClick={() => setRemoveIndex(null)}
            sx={designerCancelButtonSx}
            autoFocus
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (removeIndex !== null)
                dispatch(planTemplateRemoved(removeIndex));
              setRemoveIndex(null);
            }}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
