import {Skeleton, TextField as MuiTextField} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import z from 'zod';
import {BaseFieldParametersSchema} from '@faims3/data-model';
import {FormFieldContextProps} from '../../../formModule/types';
import {ParentFieldDisplayRenderer} from '../../../rendering/fields/view/specialised/ParentFieldDisplay';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';
import {resolveParentFieldValue} from './resolveParentField';
import {logWarn} from '../../../logging';
import {useEffect} from 'react';

const ParentFieldDisplayPropsSchema = BaseFieldParametersSchema.extend({
  // Field ID in the parent form whose value is displayed.
  parentFieldId: z.string(),
});

type ParentFieldDisplayProps = z.infer<typeof ParentFieldDisplayPropsSchema>;
type ParentFieldDisplayFullProps = ParentFieldDisplayProps &
  FormFieldContextProps;

/**
 * Read-only field showing a value from this record's parent. The value is
 * resolved live from the parent's current data on render, and the resolved
 * value is written into form state so it persists on save and appears in
 * exports. The stored value is accurate as of the child's last save.
 */
const ParentFieldDisplay = (props: ParentFieldDisplayFullProps) => {
  const {config, parentFieldId, state, setFieldData} = props;
  // Preview mode (designer) has no data engine or record.
  const fullConfig = config.mode === 'full' ? config : null;

  const query = useQuery({
    queryKey: ['parent-field-display', fullConfig?.recordId, parentFieldId],
    enabled: fullConfig !== null && typeof fullConfig.dataEngine === 'function',
    queryFn: () =>
      resolveParentFieldValue({
        engine: fullConfig!.dataEngine(),
        recordId: fullConfig!.recordId,
        parentFieldId,
      }),
    // Always re-resolve so edits to the parent are reflected.
    staleTime: 0,
    refetchOnMount: 'always',
    networkMode: 'always',
  });

  // Resolved value to persist. Empty string when there is no parent or the
  // configured field no longer exists, so a stale value never survives.
  const resolved = query.isSuccess
    ? query.data.kind === 'value'
      ? (query.data.display ?? '')
      : ''
    : null;

  // Write the resolved value into form state so it saves and exports.
  // Guarded so an unchanged value never dirties the form.
  useEffect(() => {
    if (resolved === null || fullConfig === null) return;
    if (state.value?.data !== resolved) {
      setFieldData(resolved);
    }
  }, [resolved]);

  let content: React.ReactNode;
  if (config.mode === 'preview') {
    content = (
      <MuiTextField
        value=""
        placeholder="Parent record value (shown when editing a record)"
        fullWidth
        disabled
        variant="outlined"
      />
    );
  } else if (typeof config.dataEngine !== 'function') {
    // Full mode without an engine is a wiring error, not a preview.
    logWarn('ParentFieldDisplay: full mode config missing data engine');
    content = (
      <MuiTextField
        value="Unable to load parent record value"
        fullWidth
        disabled
        variant="outlined"
        error
      />
    );
  } else if (query.isPending) {
    // Skeleton sizes itself from the (hidden) input it stands in for.
    content = (
      <Skeleton variant="rounded">
        <MuiTextField fullWidth disabled variant="outlined" />
      </Skeleton>
    );
  } else if (query.isError) {
    content = (
      <MuiTextField
        value="Unable to load parent record value"
        fullWidth
        disabled
        variant="outlined"
        error
      />
    );
  } else {
    const result = query.data;
    const display =
      result.kind === 'value'
        ? result.display || '—'
        : result.kind === 'no-parent'
          ? '—'
          : 'Configured parent field not found';
    content = (
      <MuiTextField value={display} fullWidth disabled variant="outlined" />
    );
  }

  return (
    <FieldWrapper
      heading={props.label}
      subheading={props.helperText}
      advancedHelperText={props.advancedHelperText}
    >
      {content}
    </FieldWrapper>
  );
};

export const parentFieldDisplaySpec: FieldInfo<ParentFieldDisplayFullProps> = {
  namespace: 'faims-custom',
  name: 'ParentFieldDisplay',
  // The resolved parent value is persisted on save (String) so it appears
  // in exported data. Display still resolves live on render.
  returns: 'faims-core::String',
  component: ParentFieldDisplay,
  fieldPropsSchema: ParentFieldDisplayPropsSchema,
  // Never blocks validation; the user cannot influence the value.
  fieldDataSchemaFunction: () => z.any().nullable().optional(),
  isCompleteFunction: () => true,
  excludeFromParentDisplay: true,
  view: {component: ParentFieldDisplayRenderer, config: {}},
};
