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
import {Button, Stack, Typography} from '@mui/material';

import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import UnfoldLessDoubleRoundedIcon from '@mui/icons-material/UnfoldLessDoubleRounded';
import UnfoldMoreDoubleRoundedIcon from '@mui/icons-material/UnfoldMoreDoubleRounded';

import {useEffect, useState} from 'react';
import {useAppDispatch, useAppSelector} from '../state/hooks';
import {FieldEditor} from './field-editor';
import FieldChooserDialog from './field-chooser-dialog';

type Props = {
  viewSetId: string;
  viewId: string;
  moveFieldCallback: (targetViewId: string) => void;
};

export const FieldList = ({viewSetId, viewId, moveFieldCallback}: Props) => {
  const fView = useAppSelector(
    state => state.notebook['ui-specification'].present.fviews[viewId]
  );

  const fields = useAppSelector(
    state => state.notebook['ui-specification'].present.fields
  );

  const dispatch = useAppDispatch();

  const [hiddenExpanded, setHiddenExpanded] = useState(true);
  const hiddenFields = fView.fields.filter(
    fieldName => fields[fieldName]?.['component-parameters']?.hidden
  );

  const visibleFields = fView.fields.filter(
    fieldName => !fields[fieldName]?.['component-parameters']?.hidden
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [addAfterField, setAddAfterField] = useState('');

  const openDialog = () => {
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
  };

  const addFieldAfterCallback = (fieldName: string) => {
    setAddAfterField(fieldName);
    setDialogOpen(true);
  };

  const handleDialogConfirm = (fieldName: string, fieldType: string) => {
    dispatch({
      type: 'ui-specification/fieldAdded',
      payload: {
        fieldName,
        fieldType,
        viewId,
        viewSetId,
        addAfter: addAfterField,
      },
    });
    setDialogOpen(false);
  };

  const [isExpanded, setIsExpanded] = useState<{[key: string]: boolean}>({});
  const [showCollapseButton, setShowCollapseButton] = useState(false);

  const allClosed: {[key: string]: boolean} = {};
  const allOpen: {[key: string]: boolean} = {};
  fView.fields.forEach((fieldName: string) => {
    const designerIdentifier = fields[fieldName]?.designerIdentifier;
    if (designerIdentifier) {
      allClosed[designerIdentifier] = false;
      allOpen[designerIdentifier] = true;
    }
  });

  useEffect(() => {
    // if fView.label changes we are viewing a different
    // section, so reset all fields to be closed
    setIsExpanded(allClosed);
  }, [fView.label]);

  const handleExpandChange = (designerIdentifier: string) => {
    return (_event: React.SyntheticEvent, expanded: boolean) => {
      setIsExpanded(prevState => ({
        ...prevState,
        [designerIdentifier]: expanded,
      }));
    };
  };

  return (
    <>
      <Stack direction="row" spacing={1} mt={2}>
        <Button
          variant="outlined"
          size="small"
          onClick={openDialog}
          startIcon={<AddCircleOutlineRoundedIcon />}
        >
          Add a Field
        </Button>

        {showCollapseButton ? (
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setIsExpanded(allClosed);
              setShowCollapseButton(false);
            }}
            startIcon={<UnfoldLessDoubleRoundedIcon />}
          >
            Collapse All Fields
          </Button>
        ) : (
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setIsExpanded(allOpen);
              setShowCollapseButton(true);
            }}
            startIcon={<UnfoldMoreDoubleRoundedIcon />}
          >
            Expand All Fields
          </Button>
        )}
      </Stack>

      <Stack spacing={0} mt={2} mb={2}>
        <Typography variant="h6">Visible Fields</Typography>
        <Typography variant="body2" color="textSecondary">
          Visible fields will appear in the survey.
        </Typography>
      </Stack>
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
            handleExpandChange={handleExpandChange(designerIdentifier)}
            moveFieldCallback={moveFieldCallback}
          />
        );
      })}

      <Typography variant="h6" mt={2}>
        Hidden Fields
      </Typography>
      {hiddenFields.length > 0 ? (
        <>
          <div style={{padding: '16px 0'}}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setHiddenExpanded(!hiddenExpanded)}
              startIcon={
                hiddenExpanded ? (
                  <UnfoldLessDoubleRoundedIcon />
                ) : (
                  <UnfoldMoreDoubleRoundedIcon />
                )
              }
            >
              {hiddenExpanded
                ? 'Collapse Hidden Fields'
                : 'Expand Hidden Fields'}
            </Button>
          </div>
          {hiddenExpanded &&
            hiddenFields.map((fieldName: string) => {
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
                  handleExpandChange={handleExpandChange(designerIdentifier)}
                />
              );
            })}
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
