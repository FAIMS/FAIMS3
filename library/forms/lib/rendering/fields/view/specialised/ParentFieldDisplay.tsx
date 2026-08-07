import {Skeleton, Typography} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import {resolveParentFieldValue} from '../../../../fieldRegistry/fields/ParentFieldDisplay/resolveParentField';
import {DataViewFieldRender} from '../../../types';
import {EmptyResponsePlaceholder, TextWrapper} from '../wrappers';

/**
 * View renderer for ParentFieldDisplay. The record stores no value; the
 * parent's current value is resolved live, matching the edit-mode behaviour.
 */
export const ParentFieldDisplayRenderer: DataViewFieldRender = props => {
  const {record, fieldId, uiSpecification} = props.renderContext;

  // parentFieldId lives in the field's component parameters.
  const parentFieldId =
    uiSpecification.fields[fieldId]?.['component-parameters']?.parentFieldId;

  const query = useQuery({
    queryKey: ['parent-field-display-view', record._id, parentFieldId],
    enabled: typeof parentFieldId === 'string',
    queryFn: () =>
      resolveParentFieldValue({
        engine: props.renderContext.tools.getDataEngine(),
        recordId: record._id,
        parentFieldId: parentFieldId as string,
      }),
    staleTime: 0,
    refetchOnMount: 'always',
    networkMode: 'always',
  });

  if (typeof parentFieldId !== 'string') {
    return <TextWrapper content="Field is not configured." />;
  }
  if (query.isPending) {
    // Skeleton sizes itself from the placeholder text it stands in for.
    return (
      <Skeleton variant="text">
        <Typography>Loading parent record value</Typography>
      </Skeleton>
    );
  }
  if (query.isError) {
    return (
      <Typography color="error" variant="body2">
        Unable to load parent record value.
      </Typography>
    );
  }

  const result = query.data;
  if (result.kind === 'value' && result.display) {
    return <TextWrapper content={result.display} />;
  }
  if (result.kind === 'field-not-found') {
    return <TextWrapper content="Configured parent field not found." />;
  }
  // No parent, or the parent field is empty.
  return <EmptyResponsePlaceholder />;
};
