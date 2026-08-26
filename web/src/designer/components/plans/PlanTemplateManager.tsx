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
 * template mode, a chooser for plan types, per-type authoring dialogs, and
 * edit/remove for the single existing plan template.
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
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {alpha} from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {shallowEqual} from 'react-redux';
import type {PlanTemplate} from '@faims3/data-model';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {selectDesignerMode} from '../../store/selectors';
import {
  planTemplateRemoved,
  planTemplateSet,
} from '../../state/planTemplate-reducer';
import {config} from '../../buildconfig';
import {getDesignerPlanType, getDesignerPlanTypes} from '../../plans';
import {
  designerCancelButtonSx,
  designerDialogActionsSx,
  designerDialogTitleSx,
  designerPrimaryActionButtonSx,
} from '../designer-style';

/** Add/edit/remove the template's single plan template; hidden outside template mode. */
export const PlanTemplateManager = () => {
  const theme = useTheme();
  const dispatch = useAppDispatch();

  const mode = useAppSelector(selectDesignerMode);
  const planTemplate = useAppSelector(
    state => state.notebook.planTemplate,
    shallowEqual
  );
  const uiSpec = useAppSelector(
    state => state.notebook.uiSpec.present,
    shallowEqual
  );
  const viewSets = uiSpec.viewsets;

  const [chooserOpen, setChooserOpen] = useState(false);
  const [editorPlanType, setEditorPlanType] = useState<string | null>(null);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

  // Plans are only authored on templates. When the feature flag is off, hide
  // Add Plan for templates without a plan; existing plans stay editable.
  if (mode !== 'template') {
    return null;
  }
  if (!config.enablePlansInDesigner && !planTemplate) {
    return null;
  }

  const definition = planTemplate
    ? getDesignerPlanType(planTemplate.planType)
    : undefined;
  const EditorDialog = editorPlanType
    ? getDesignerPlanType(editorPlanType)?.Dialog
    : undefined;

  const formType = planTemplate?.formType as string | undefined;
  const formLabel = formType ? viewSets[formType]?.label : undefined;
  const formMissing = Boolean(planTemplate && formType && !formLabel);

  const planTypes = getDesignerPlanTypes();

  const handleSave = (saved: PlanTemplate) => {
    dispatch(planTemplateSet(saved));
    setEditorPlanType(null);
  };

  return (
    <>
      {!planTemplate ? (
        <Button
          variant="contained"
          size="small"
          startIcon={<AddRoundedIcon />}
          onClick={() => setChooserOpen(true)}
          data-testid="web-designer-add-plan-button"
          sx={{
            ...designerPrimaryActionButtonSx,
            boxShadow: 'none',
            whiteSpace: 'nowrap',
            textTransform: 'none',
            fontWeight: 700,
          }}
        >
          Add Plan
        </Button>
      ) : (
        <>
          <Chip
            icon={formMissing ? <WarningAmberRoundedIcon /> : undefined}
            label={
              formMissing
                ? `${definition?.label ?? planTemplate.planType} plan: form missing`
                : `${definition?.label ?? planTemplate.planType} plan: ${formLabel}`
            }
            color={formMissing ? 'warning' : 'default'}
            onClick={() => setEditorPlanType(planTemplate.planType as string)}
            onDelete={() => setRemoveConfirmOpen(true)}
            deleteIcon={
              <Tooltip title="Remove plan">
                <DeleteOutlineRoundedIcon />
              </Tooltip>
            }
            sx={{fontWeight: 600}}
          />
          <Tooltip title="Edit plan">
            <IconButton
              size="small"
              aria-label="edit plan"
              onClick={() => setEditorPlanType(planTemplate.planType as string)}
            >
              <EditRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      )}

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
                      setEditorPlanType(plan.planType);
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
          open={Boolean(editorPlanType)}
          uiSpec={uiSpec}
          initialTemplate={
            planTemplate?.planType === editorPlanType ? planTemplate : undefined
          }
          onClose={() => setEditorPlanType(null)}
          onSave={handleSave}
        />
      )}

      {/* Remove confirmation */}
      <Dialog
        open={removeConfirmOpen}
        onClose={() => setRemoveConfirmOpen(false)}
      >
        <DialogTitle sx={designerDialogTitleSx}>Remove plan?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{mt: 1}}>
            Notebooks created from this template will no longer include a data
            collection plan.
          </Typography>
        </DialogContent>
        <DialogActions sx={designerDialogActionsSx}>
          <Button
            onClick={() => setRemoveConfirmOpen(false)}
            sx={designerCancelButtonSx}
            autoFocus
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              dispatch(planTemplateRemoved());
              setRemoveConfirmOpen(false);
            }}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
