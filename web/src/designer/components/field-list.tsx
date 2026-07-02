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
 * @file Ordered field accordions for a section plus add-field dialog.
 */

import {Alert, Box, Button, Stack, Tooltip, Typography} from '@mui/material';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable';

import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ExpandCircleDownRoundedIcon from '@mui/icons-material/ExpandCircleDownRounded';
import InfoIcon from '@mui/icons-material/Info';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {useLocation} from 'react-router-dom';
import {useAppDispatch, useAppSelector} from '../state/hooks';
import {FieldEditor} from './field-editor';
import FieldChooserDialog from './field-chooser-dialog';
import {fieldAdded, fieldReordered} from '../store/slices/uiSpec';
import {
  designerControlLabelSx,
  designerFieldSubHeadingSx,
  designerHeadingRowSx,
  designerHeadingTextSx,
  designerInfoIconSx,
  designerPrimaryActionButtonSx,
} from './designer-style';
import {HeadingWithInfo} from './heading-with-info';
import {resolveAddedFieldKey} from '../domain/notebook/ids';

type Props = {
  viewSetId: string;
  viewId: string;
  moveFieldCallback: (targetViewId: string) => void;
};

/**
 * Lists visible and hidden fields for one section; dispatches `fieldAdded` and
 * resets accordion state when `viewId` changes (different section).
 */
export const FieldList = ({viewSetId, viewId, moveFieldCallback}: Props) => {
  const fView = useAppSelector(
    state => state.notebook.uiSpec.present.views[viewId]
  );

  const fields = useAppSelector(state => state.notebook.uiSpec.present.fields);

  const dispatch = useAppDispatch();
  const location = useLocation();
  const fieldParam = new URLSearchParams(location.search).get('field');

  const hiddenFields = useMemo(
    () =>
      fView.fields.filter(
        fieldName => fields[fieldName]?.['component-parameters']?.hidden
      ),
    [fView.fields, fields]
  );

  const visibleFields = useMemo(
    () =>
      fView.fields.filter(
        fieldName => !fields[fieldName]?.['component-parameters']?.hidden
      ),
    [fView.fields, fields]
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [addAfterField, setAddAfterField] = useState('');
  /** Predicted storage key for the next fieldAdded dispatch — enables expand/focus before Redux updates. */
  const [autoFocusFieldKey, setAutoFocusFieldKey] = useState<string | null>(
    null
  );

  const openDialog = () => {
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
  };

  const addFieldAfterCallback = useCallback((fieldName: string) => {
    setAddAfterField(fieldName);
    setDialogOpen(true);
  }, []);

  const handleDialogConfirm = useCallback(
    (fieldType: string) => {
      const defaultFieldName = 'New Field';
      // Pre-compute the slug fieldAdded will assign so we can expand the accordion immediately.
      const newFieldKey = resolveAddedFieldKey(
        defaultFieldName,
        Object.keys(fields)
      );

      dispatch(
        fieldAdded({
          fieldName: defaultFieldName,
          fieldType,
          viewId,
          viewSetId,
          addAfter: addAfterField,
        })
      );
      setAutoFocusFieldKey(newFieldKey);
      setDialogOpen(false);
    },
    [addAfterField, dispatch, fields, viewId, viewSetId]
  );

  const [isExpanded, setIsExpanded] = useState<{[key: string]: boolean}>({});
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {distance: 2},
    })
  );

  const allClosed = useMemo(() => {
    const next: {[key: string]: boolean} = {};
    fView.fields.forEach((fieldName: string) => {
      const designerIdentifier = fields[fieldName]?.designerIdentifier;
      if (designerIdentifier) {
        next[designerIdentifier] = false;
      }
    });
    return next;
  }, [fView.fields, fields]);

  const allOpen = useMemo(() => {
    const next: {[key: string]: boolean} = {};
    fView.fields.forEach((fieldName: string) => {
      const designerIdentifier = fields[fieldName]?.designerIdentifier;
      if (designerIdentifier) {
        next[designerIdentifier] = true;
      }
    });
    return next;
  }, [fView.fields, fields]);

  useEffect(() => {
    if (!autoFocusFieldKey) return;
    const designerIdentifier = fields[autoFocusFieldKey]?.designerIdentifier;
    if (!designerIdentifier) return;

    // Expand the new field accordion once the reducer has written the field spec.
    setIsExpanded(prev => ({...prev, [designerIdentifier]: true}));
  }, [autoFocusFieldKey, fields]);

  useEffect(() => {
    // When viewId changes we are viewing a different section — reset accordion state.
    // Do not depend on `allClosed` / field data: that object is recreated on every field
    // edit and would collapse open accordions whenever the spec updates.
    setIsExpanded({});
    setAutoFocusFieldKey(null);
  }, [viewId]);

  useEffect(() => {
    if (!fieldParam || !fView.fields.includes(fieldParam)) return;

    const designerIdentifier = fields[fieldParam]?.designerIdentifier;
    if (!designerIdentifier) return;

    setIsExpanded(prev => ({...prev, [designerIdentifier]: true}));
  }, [viewId, fieldParam, fView.fields, fields]);

  const handleExpandedChange = useCallback(
    (designerIdentifier: string, expanded: boolean) => {
      setIsExpanded(prevState => {
        if (prevState[designerIdentifier] === expanded) return prevState;
        return {
          ...prevState,
          [designerIdentifier]: expanded,
        };
      });
    },
    []
  );

  const hasExpandedField = useMemo(
    () => Object.values(isExpanded).some(Boolean),
    [isExpanded]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const {active, over} = event;
      if (!over || active.id === over.id) return;

      const sourceIndex = fView.fields.findIndex(
        fieldName => fieldName === active.id
      );
      const targetIndex = fView.fields.findIndex(
        fieldName => fieldName === over.id
      );

      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex)
        return;

      dispatch(fieldReordered({viewId, sourceIndex, targetIndex}));
    },
    [dispatch, fView.fields, viewId]
  );

  return (
    <>
      <Stack
        direction="row"
        spacing={1}
        sx={{...designerHeadingRowSx, alignItems: 'center', mt: 2, mb: 1}}
      >
        <Typography variant="h2" sx={designerHeadingTextSx}>
          Fields
        </Typography>
        <Tooltip title="Fields are the individual inputs that collect data in this section.">
          <InfoIcon sx={designerInfoIconSx} />
        </Tooltip>
        <Button
          variant="contained"
          size="small"
          onClick={openDialog}
          startIcon={<AddRoundedIcon />}
          sx={designerPrimaryActionButtonSx}
        >
          New Field
        </Button>
      </Stack>

      {hasExpandedField && (
        <Alert
          severity="info"
          icon={false}
          sx={{
            mt: 1,
            py: 0.25,
            px: 1,
            fontSize: '0.78rem',
            lineHeight: 1.3,
            width: 'fit-content',
            maxWidth: '100%',
            borderRadius: 1,
            '& .MuiAlert-message': {py: 0.25, fontWeight: 500},
          }}
        >
          Collapse expanded fields to enable drag-and-drop reordering.
        </Alert>
      )}

      <Box
        sx={{
          width: '100%',
          mt: 3,
          mb: 1.5,
          ml: 0,
          mr: 'auto',
          textAlign: 'left',
        }}
      >
        <Stack
          direction="row"
          spacing={0.75}
          sx={{alignItems: 'center', flexWrap: 'wrap'}}
        >
          <HeadingWithInfo
            title="Visible fields"
            variant="subtitle1"
            tooltip="Visible fields are shown to users in this section. They will appear in the survey."
            titleSx={{
              ...(designerFieldSubHeadingSx as Record<string, unknown>),
              fontSize: '1.1rem',
            }}
            iconSx={{fontSize: '1.35rem', ml: 0.35}}
            containerSx={{
              justifyContent: 'flex-start',
              alignItems: 'center',
              alignSelf: 'flex-start',
              width: 'auto',
              textAlign: 'left',
            }}
          />
          <Button
            variant="text"
            size="small"
            onClick={() => setIsExpanded(allOpen)}
            startIcon={
              <ExpandCircleDownRoundedIcon sx={{fontSize: '0.95rem'}} />
            }
            sx={{
              ...designerControlLabelSx,
              minWidth: 'auto',
              px: 0.6,
              py: 0.1,
              fontSize: '0.72rem',
              '& .MuiButton-startIcon': {mr: 0.4},
            }}
          >
            Expand all
          </Button>
          <Button
            variant="text"
            size="small"
            onClick={() => setIsExpanded(allClosed)}
            startIcon={
              <ExpandCircleDownRoundedIcon
                sx={{fontSize: '0.95rem', transform: 'rotate(180deg)'}}
              />
            }
            sx={{
              ...designerControlLabelSx,
              minWidth: 'auto',
              px: 0.6,
              py: 0.1,
              fontSize: '0.72rem',
              '& .MuiButton-startIcon': {mr: 0.4},
            }}
          >
            Collapse all
          </Button>
        </Stack>
      </Box>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleFields}
          strategy={verticalListSortingStrategy}
        >
          {visibleFields.map((fieldName: string) => {
            const field = fields[fieldName];
            const designerIdentifier = field?.designerIdentifier;

            if (!field || !designerIdentifier) return null;

            return (
              <FieldEditor
                key={designerIdentifier}
                fieldName={fieldName}
                viewSetId={viewSetId}
                viewId={viewId}
                expanded={isExpanded[designerIdentifier] ?? false}
                addFieldCallback={addFieldAfterCallback}
                onExpandedChange={handleExpandedChange}
                designerIdentifier={designerIdentifier}
                moveFieldCallback={moveFieldCallback}
                dragDisabled={hasExpandedField}
                autoFocusLabel={autoFocusFieldKey === fieldName}
                onLabelFocused={() => {
                  setAutoFocusFieldKey(prev =>
                    prev === fieldName ? null : prev
                  );
                }}
              />
            );
          })}
        </SortableContext>
      </DndContext>

      <Box sx={{mt: 2}}>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{alignItems: 'center', flexWrap: 'wrap'}}
        >
          <HeadingWithInfo
            title="Hidden fields"
            variant="subtitle1"
            tooltip="Hidden fields stay in the schema but are not shown to users. They are available but do not appear in the survey."
            titleSx={{
              ...(designerFieldSubHeadingSx as Record<string, unknown>),
              fontSize: '1.1rem',
            }}
            iconSx={{fontSize: '1.35rem', ml: 0.35}}
            containerSx={{
              justifyContent: 'flex-start',
              alignSelf: 'flex-start',
              width: 'auto',
              textAlign: 'left',
            }}
          />
          <Button
            variant="text"
            size="small"
            onClick={() => setIsExpanded(allOpen)}
            startIcon={
              <ExpandCircleDownRoundedIcon sx={{fontSize: '0.95rem'}} />
            }
            sx={{
              ...designerControlLabelSx,
              minWidth: 'auto',
              px: 0.6,
              py: 0.1,
              fontSize: '0.72rem',
              '& .MuiButton-startIcon': {mr: 0.4},
            }}
          >
            Expand all
          </Button>
          <Button
            variant="text"
            size="small"
            onClick={() => setIsExpanded(allClosed)}
            startIcon={
              <ExpandCircleDownRoundedIcon
                sx={{fontSize: '0.95rem', transform: 'rotate(180deg)'}}
              />
            }
            sx={{
              ...designerControlLabelSx,
              minWidth: 'auto',
              px: 0.6,
              py: 0.1,
              fontSize: '0.72rem',
              '& .MuiButton-startIcon': {mr: 0.4},
            }}
          >
            Collapse all
          </Button>
        </Stack>
      </Box>
      {hiddenFields.length > 0 ? (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={hiddenFields}
              strategy={verticalListSortingStrategy}
            >
              {hiddenFields.map((fieldName: string) => {
                const field = fields[fieldName];
                const designerIdentifier = field?.designerIdentifier;

                if (!field || !designerIdentifier) return null;

                return (
                  <FieldEditor
                    key={designerIdentifier}
                    fieldName={fieldName}
                    viewSetId={viewSetId}
                    viewId={viewId}
                    expanded={isExpanded[designerIdentifier] ?? false}
                    addFieldCallback={addFieldAfterCallback}
                    moveFieldCallback={moveFieldCallback}
                    onExpandedChange={handleExpandedChange}
                    designerIdentifier={designerIdentifier}
                    dragDisabled={hasExpandedField}
                    autoFocusLabel={autoFocusFieldKey === fieldName}
                    onLabelFocused={() => {
                      setAutoFocusFieldKey(prev =>
                        prev === fieldName ? null : prev
                      );
                    }}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No hidden fields
        </Typography>
      )}

      <FieldChooserDialog
        open={dialogOpen}
        onClose={closeDialog}
        onConfirm={handleDialogConfirm}
      />
    </>
  );
};
