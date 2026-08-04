import {Skeleton, TextField as MuiTextField} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import z from 'zod';
import {BaseFieldParametersSchema} from '@faims3/data-model';
import {FormFieldContextProps} from '../../../formModule/types';
import {ParentFieldDisplayRenderer} from '../../../rendering/fields/view/specialised/ParentFieldDisplay';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';
import {resolveParentFieldValue} from './resolveParentField';

const ParentFieldDisplayPropsSchema = BaseFieldParametersSchema.extend({
  // Field ID in the parent form whose value is displayed.
  parentFieldId: z.string(),
});

type ParentFieldDisplayProps = z.infer<typeof ParentFieldDisplayPropsSchema>;
type ParentFieldDisplayFullProps = ParentFieldDisplayProps &
  FormFieldContextProps;

/**
 * Read-only field showing a value from this record's parent. Nothing is
 * stored on the record; the value is resolved live from the parent's current
 * data, so parent edits are always reflected.
 */
const ParentFieldDisplay = (props: ParentFieldDisplayFullProps) => {
  const {config, parentFieldId} = props;
  // Preview mode (designer) has no data engine or record.
  const fullConfig = config.mode === 'full' ? config : null;

  const query = useQuery({
    queryKey: ['parent-field-display', fullConfig?.recordId, parentFieldId],
    enabled: fullConfig !== null,
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

  let content: React.ReactNode;
  if (!fullConfig) {
    content = (
      <MuiTextField
        value=""
        placeholder="Parent record value (shown when editing a record)"
        fullWidth
        disabled
        variant="outlined"
      />
    );
  } else if (query.isPending) {
    content = <Skeleton variant="rounded" height={56} />;
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
  // Display only - no value is stored.
  returns: null,
  component: ParentFieldDisplay,
  fieldPropsSchema: ParentFieldDisplayPropsSchema,
  // Never blocks validation; the user cannot influence the value.
  fieldDataSchemaFunction: () => z.any().nullable().optional(),
  isCompleteFunction: () => true,
  view: {component: ParentFieldDisplayRenderer, config: {}},
};
