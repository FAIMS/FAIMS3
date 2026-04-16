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

import {Box, Button, Stack, Typography} from '@mui/material';
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
import {useCallback, useEffect, useMemo, useState} from 'react';
import {useAppDispatch, useAppSelector} from '../state/hooks';
import {FieldEditor} from './field-editor';
import FieldChooserDialog from './field-chooser-dialog';
import {fieldAdded, fieldReordered} from '../store/slices/uiSpec';
import {
  designerControlActionRowSx,
  designerControlHeadingSx,
  designerControlLabelSx,
  designerFieldSubHeadingSx,
  designerPrimaryActionButtonSx,
  designerSubheadingSx,
} from './designer-style';
import {HeadingWithInfo} from './heading-with-info';

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
    state => state.notebook['ui-specification'].present.fviews[viewId]
  );

  const fields = useAppSelector(
    state => state.notebook['ui-specification'].present.fields
  );

  const dispatch = useAppDispatch();

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
    (fieldName: string, fieldType: string) => {
      dispatch(
        fieldAdded({
          fieldName,
          fieldType,
          viewId,
          viewSetId,
          addAfter: addAfterField,
        })
      );
      setDialogOpen(false);
    },
    [addAfterField, dispatch, viewId, viewSetId]
  );

  const [isExpanded, setIsExpanded] = useState<{[key: string]: boolean}>({});
  const [showCollapseButton, setShowCollapseButton] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {distance: 6},
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
    // When viewId changes we are viewing a different section — reset accordion state.
    // Do not depend on `allClosed` / field data: that object is recreated on every field
    // edit and would collapse open accordions whenever the spec updates.
    setIsExpanded({});
    setShowCollapseButton(false);
  }, [viewId]);

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

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const {active, over} = event;
      if (!over || active.id === over.id) return;

      const sourceIndex = fView.fields.findIndex(fieldName => fieldName === active.id);
      const targetIndex = fView.fields.findIndex(fieldName => fieldName === over.id);

      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;

      dispatch(fieldReordered({viewId, sourceIndex, targetIndex}));
    },
    [dispatch, fView.fields, viewId]
  );

  return (
    <>
      <Stack direction="row" spacing={1.5} alignItems="center" mt={1}>
        <Typography variant="subtitle1" sx={designerControlHeadingSx}>
          Field controls
        </Typography>
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

      <Stack direction="row" spacing={1} sx={designerControlActionRowSx}>
        <Button
          variant="text"
          size="small"
          onClick={() => {
            setIsExpanded(showCollapseButton ? allClosed : allOpen);
            setShowCollapseButton(!showCollapseButton);
          }}
          startIcon={
            showCollapseButton ? (
              <ExpandCircleDownRoundedIcon
                sx={{fontSize: '1.55rem', transform: 'rotate(180deg)'}}
              />
            ) : (
              <ExpandCircleDownRoundedIcon sx={{fontSize: '1.55rem'}} />
            )
          }
          sx={{
            ...designerControlLabelSx,
            '& .MuiButton-startIcon': {mr: 1},
          }}
        >
          {showCollapseButton ? 'Collapse all' : 'Expand all'}
        </Button>
      </Stack>

      <Box
        sx={{
          width: '100%',
          mt: 2,
          mb: 2,
          ml: 0,
          mr: 'auto',
          textAlign: 'left',
        }}
      >
        <HeadingWithInfo
          title="Visible fields"
          variant="subtitle1"
          tooltip="Visible fields are shown to users in this section."
          titleSx={designerFieldSubHeadingSx as Record<string, unknown>}
          containerSx={{
            justifyContent: 'flex-start',
            alignItems: 'center',
            alignSelf: 'flex-start',
            width: '100%',
            textAlign: 'left',
          }}
        />
        <Typography
          variant="body2"
          color="textSecondary"
          sx={{...designerSubheadingSx, textAlign: 'left'}}
        >
          Visible fields will appear in the survey.
        </Typography>
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
              />
            );
          })}
        </SortableContext>
      </DndContext>

      <Box mt={2}>
        <HeadingWithInfo
          title="Hidden fields"
          variant="subtitle1"
          tooltip="Hidden fields stay in the schema but are not shown to users."
          titleSx={designerFieldSubHeadingSx as Record<string, unknown>}
          containerSx={{
            justifyContent: 'flex-start',
            alignSelf: 'flex-start',
            width: '100%',
            textAlign: 'left',
          }}
        />
      </Box>
      <Typography
        variant="body2"
        color="textSecondary"
        sx={{...designerSubheadingSx, textAlign: 'left'}}
      >
        Hidden fields are available but do not appear in the survey.
      </Typography>
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
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        </>
      ) : (
        <Typography variant="body2" color="textSecondary">
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
