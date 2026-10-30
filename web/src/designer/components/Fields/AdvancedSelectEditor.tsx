// SPDX-License-Identifier: Apache-2.0

import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';

import {yaml as yamlLanguage} from '@codemirror/lang-yaml';
import {EditorState} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {
  Alert,
  AlertTitle,
  Button,
  Card,
  Collapse,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  Radio,
  RadioGroup,
} from '@mui/material';
import debounce from 'lodash/debounce';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import YAML from 'yaml';

import {AdvancedSelectFieldProps} from '@faims3/forms';
import {FieldType} from '../../state/initial';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {fieldUpdated} from '../../store/slices/uiSpec';
import {BaseFieldEditor} from './BaseFieldEditor';

type OptionTreeType = {
  name: string;
  type?: string;
  label?: string;
  children?: OptionTreeType[];
};

type NewState = {
  optionTree: OptionTreeType[];
  valueType: string;
};

const DEBOUNCE_MS = 500;

const serializeOptionTree = (optionTree: OptionTreeType[] = []) =>
  YAML.stringify(optionTree, {indent: 2, lineWidth: 0});

const isTypeMatch = (optionTree: OptionTreeType[]) => {
  optionTree.forEach((opt: OptionTreeType) => {
    const validKeys: string[] = ['name', 'type', 'label', 'children'];

    if (!Object.keys(opt).every(key => validKeys.includes(key))) {
      throw new Error(
        "Invalid property. Only 'name', 'type', 'label' and 'children' properties are accepted."
      );
    }

    if (!opt.name) {
      throw new Error(
        'Missing property: name. Please refer to the example and try again.'
      );
    }

    if (typeof opt.name !== 'string') {
      throw new Error(
        "Invalid 'name' property. The 'name' property must be a string. Please refer to the example and try again."
      );
    }

    if (opt.label !== undefined && typeof opt.label !== 'string') {
      throw new Error(
        `Invalid 'label' property at level ${opt.name}. The 'label' property must be a string. Please refer to the example and try again.`
      );
    }

    if (!Array.isArray(opt.children)) {
      throw new Error(
        `Missing property: children at level ${opt.name}. Please refer to the example and try again.`
      );
    }

    isTypeMatch(opt.children);
  });
};

const parseOptionTreeFromYaml = (yamlText: string): OptionTreeType[] => {
  let parsed: unknown;

  try {
    parsed = YAML.parse(yamlText);
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`YAML parse error: ${error.message}`);
    }
    throw new Error('YAML parse error.');
  }

  if (parsed == null || parsed === '') {
    return [];
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Option tree must be a YAML array of entries.');
  }

  isTypeMatch(parsed);
  return parsed;
};

/** Hierarchical option tree editor and value mode (`full` vs stored id) for `AdvancedSelect`. */
export const AdvancedSelectEditor = ({fieldName}: {fieldName: string}) => {
  const field = useAppSelector(
    state => state.notebook.uiSpec.present.fields[fieldName]
  );
  const dispatch = useAppDispatch();

  const params = field['component-parameters'] as AdvancedSelectFieldProps;
  const currentOptionTree = Array.isArray(params.ElementProps?.optiontree)
    ? (params.ElementProps.optiontree as OptionTreeType[])
    : [];
  const currentValueType = params.valuetype || 'full';

  const [yamlValue, setYamlValue] = useState(() =>
    serializeOptionTree(currentOptionTree)
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [open, setOpen] = useState(false);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const previousFieldNameRef = useRef(fieldName);
  const fieldRef = useRef(field);
  const valueTypeRef = useRef(currentValueType);

  useEffect(() => {
    fieldRef.current = field;
  }, [field]);

  useEffect(() => {
    valueTypeRef.current = currentValueType;
  }, [currentValueType]);

  const updateFieldFromState = useCallback(
    (newState: NewState) => {
      const newField = JSON.parse(JSON.stringify(fieldRef.current)) as FieldType;
      const newParams = newField[
        'component-parameters'
      ] as AdvancedSelectFieldProps;
      newParams.valuetype = newState.valueType as 'full' | 'child';

      if (newParams.ElementProps) {
        newParams.ElementProps.optiontree =
          newState.optionTree as unknown as typeof newParams.ElementProps.optiontree;
      }

      dispatch(fieldUpdated({fieldName, newField}));
    },
    [dispatch, fieldName]
  );

  const updateProperty = useCallback(
    (prop: 'optionTree' | 'valueType', value: string | OptionTreeType[]) => {
      const nextState: NewState = {
        optionTree:
          prop === 'optionTree'
            ? (value as OptionTreeType[])
            : currentOptionTree,
        valueType: prop === 'valueType' ? (value as string) : currentValueType,
      };

      updateFieldFromState(nextState);
    },
    [currentOptionTree, currentValueType, updateFieldFromState]
  );

  const saveOptionTree = useCallback(
    (nextYaml: string) => {
      try {
        const optionTree = parseOptionTreeFromYaml(nextYaml);
        updateFieldFromState({
          optionTree,
          valueType: valueTypeRef.current,
        });
        setErrorMessage('');
        setSuccessMessage('Saved successfully.');
      } catch (error: unknown) {
        if (error instanceof Error) {
          setErrorMessage(error.message);
          setSuccessMessage('');
        }
      }
    },
    [updateFieldFromState]
  );

  const debouncedSave = useMemo(
    () =>
      debounce((nextYaml: string) => {
        saveOptionTree(nextYaml);
      }, DEBOUNCE_MS),
    [saveOptionTree]
  );

  useEffect(() => {
    return () => {
      debouncedSave.cancel();
      debouncedSave.flush();
    };
  }, [debouncedSave]);

  useEffect(() => {
    if (previousFieldNameRef.current !== fieldName) {
      previousFieldNameRef.current = fieldName;
      setYamlValue(serializeOptionTree(currentOptionTree));
    }
  }, [fieldName]);

  useEffect(() => {
    const parent = editorHostRef.current;
    if (!parent) {
      return;
    }

    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: yamlValue,
        extensions: [
          yamlLanguage(),
          EditorView.lineWrapping,
          EditorView.updateListener.of(update => {
            if (!update.docChanged) {
              return;
            }
            const nextYamlText = update.state.doc.toString();
            setYamlValue(nextYamlText);
            setErrorMessage('');
            setSuccessMessage('');
            debouncedSave(nextYamlText);
          }),
        ],
      }),
    });

    editorViewRef.current = view;

    return () => {
      view.destroy();
      editorViewRef.current = null;
    };
  }, [debouncedSave]);

  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) {
      return;
    }

    const currentDoc = view.state.doc.toString();
    if (yamlValue !== currentDoc) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentDoc.length,
          insert: yamlValue,
        },
      });
    }
  }, [yamlValue]);

  return (
    <BaseFieldEditor fieldName={fieldName}>
      <Grid size={{xs: 12, sm: 9}}>
        <Card variant="outlined">
          <Grid size={12} sx={{mx: 1.5, my: 2}}>
            <Grid
              container
              size={12}
              sx={{flexDirection: 'column', alignItems: 'center'}}
            >
              <Alert severity="info" sx={{mb: 2}}>
                <AlertTitle>Example Structure</AlertTitle>

                <p>
                  The following is an example of a valid YAML structure with 2
                  levels. The first level goes 1 level deep (i.e., stops at
                  Level 1), the second goes 2 levels deep (i.e., includes Level
                  2 and Level 2.1). The properties <code>name</code> and{' '}
                  <code>children</code> must be included, whereas the{' '}
                  <code>label</code> property is optional.
                </p>

                <Button
                  onClick={() => setOpen(!open)}
                  size="small"
                  color="info"
                  endIcon={
                    open ? (
                      <ExpandLess fontSize="small" />
                    ) : (
                      <ExpandMore fontSize="small" />
                    )
                  }
                >
                  {open ? 'Close' : 'Show Help'}
                </Button>

                <Collapse in={open} unmountOnExit>
                  <pre>
                    {serializeOptionTree([
                      {
                        name: 'level-1',
                        label: 'Level 1',
                        children: [],
                      },
                      {
                        name: 'level-2',
                        children: [
                          {
                            name: 'level-2-1',
                            label: 'Level 2.1',
                            children: [],
                          },
                        ],
                      },
                    ])}
                  </pre>
                </Collapse>
              </Alert>

              <div
                ref={editorHostRef}
                style={{
                  width: '100%',
                  minHeight: 220,
                  border: '1px solid rgba(0, 0, 0, 0.12)',
                  borderRadius: 4,
                  backgroundColor: 'rgba(0, 0, 0, 0.02)',
                }}
              />

              {errorMessage && (
                <Alert severity="error" sx={{mt: 2.5, width: '100%'}}>
                  {errorMessage}
                </Alert>
              )}

              {successMessage && (
                <Alert severity="success" sx={{mt: 2.5, width: '100%'}}>
                  {successMessage}
                </Alert>
              )}
            </Grid>
          </Grid>
        </Card>
      </Grid>

      <Grid size={{xs: 12, sm: 3}}>
        <Card variant="outlined">
          <Grid size={12} sx={{mx: 1.5, my: 2}}>
            <FormControl>
              <FormLabel id="value-type">Value Type</FormLabel>
              <RadioGroup
                aria-labelledby="value-type"
                value={currentValueType}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateProperty('valueType', e.target.value)
                }
              >
                <FormControlLabel
                  value="full"
                  control={<Radio />}
                  label="Full"
                />
                <FormControlLabel
                  value="child"
                  control={<Radio />}
                  label="Child"
                />
              </RadioGroup>
            </FormControl>
          </Grid>
        </Card>
      </Grid>
    </BaseFieldEditor>
  );
};
