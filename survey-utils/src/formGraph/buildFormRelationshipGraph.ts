import { getLabel } from '../specParser';
import type { FieldSpec, UiSpecification } from '../types';
import { buildFieldSourceFormMap } from './buildFieldSourceFormMap';

const RELATED_RECORD_COMPONENTS = new Set(['RelatedRecordSelector', 'RelatedRecord']);

export interface FormGraphNode {
  id: string;
  label: string;
}

export interface FormGraphEdge {
  from: string;
  to: string;
  relationType: string;
  fieldLabel: string;
  fieldName: string;
}

export interface FormRelationshipGraph {
  nodes: FormGraphNode[];
  edges: FormGraphEdge[];
}

function isRelatedRecordField(field: FieldSpec): boolean {
  const name = field['component-name'];
  return typeof name === 'string' && RELATED_RECORD_COMPONENTS.has(name);
}

/** Collect RelatedRecord fields and resolve source → target form links. */
export function buildFormRelationshipGraph(spec: UiSpecification): FormRelationshipGraph {
  const fieldToSourceForm = buildFieldSourceFormMap(spec);
  const nodeLabels = new Map<string, string>();

  for (const [viewsetId, viewset] of Object.entries(spec.viewsets)) {
    nodeLabels.set(viewsetId, viewset?.label ?? viewsetId);
  }

  const edges: FormGraphEdge[] = [];

  for (const [fieldName, field] of Object.entries(spec.fields)) {
    if (!isRelatedRecordField(field)) continue;

    const params = field['component-parameters'];
    const relatedType =
      params && typeof params.related_type === 'string' ? params.related_type.trim() : '';
    if (!relatedType) continue;

    const sourceForm = fieldToSourceForm.get(fieldName);
    if (!sourceForm) continue;

    if (!nodeLabels.has(relatedType)) {
      nodeLabels.set(relatedType, spec.viewsets[relatedType]?.label ?? relatedType);
    }

    const relationType =
      params && typeof params.relation_type === 'string' && params.relation_type.trim()
        ? params.relation_type.trim()
        : 'faims-core::Linked';

    edges.push({
      from: sourceForm,
      to: relatedType,
      relationType,
      fieldLabel: params ? getLabel(params) || fieldName : fieldName,
      fieldName,
    });
  }

  const connectedIds = new Set<string>();
  for (const edge of edges) {
    connectedIds.add(edge.from);
    connectedIds.add(edge.to);
  }

  const nodes: FormGraphNode[] = [...nodeLabels.entries()]
    .filter(([id]) => edges.length === 0 || connectedIds.has(id))
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return { nodes, edges };
}
