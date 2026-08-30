import {
  claimsPlan,
  CompiledNotebookUiSpec,
  MinimalRecordMetadata,
} from '@faims3/data-model';

/**
 * The notebook's records this plan claims, which is every list a plan shows.
 * Scoped by plan id alone: a claim is minted by the plan that made the record,
 * so two plans sharing a form still keep their own, and a plan type carrying no
 * form of its own is scoped the same way.
 */
export const recordsClaimedBy = ({
  records,
  planId,
}: {
  records: MinimalRecordMetadata[];
  planId: string;
}): MinimalRecordMetadata[] =>
  records.filter(record =>
    claimsPlan({planReference: record.planReference, planId})
  );

/**
 * What a plan view calls the records it lists. The plan collects one form, so
 * that form names them however many forms the notebook carries.
 */
export const planRecordLabel = ({
  uiSpecification,
  plan,
}: {
  uiSpecification: CompiledNotebookUiSpec;
  plan: {formType: string};
}): string => uiSpecification.viewsets[plan.formType]?.label || plan.formType;
