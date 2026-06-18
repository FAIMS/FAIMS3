import type { FormGraphEdge, FormRelationshipGraph } from './buildFormRelationshipGraph';

function sanitizeMermaidText(text: string): string {
  return text.replace(/["[\]|#{}]/g, ' ').replace(/\s+/g, ' ').trim();
}

function mermaidNodeId(viewsetId: string): string {
  const safe = viewsetId.replace(/[^a-zA-Z0-9_]/g, '_');
  return `form_${safe || 'unknown'}`;
}

function formatEdgeLabel(edge: FormGraphEdge): string {
  const relation =
    edge.relationType === 'faims-core::Child'
      ? 'has child'
      : edge.relationType === 'faims-core::Linked'
        ? 'linked'
        : edge.relationType.replace(/^faims-core::/, '');
  return sanitizeMermaidText(relation);
}

/** Convert a form relationship graph to Mermaid flowchart syntax. */
export function formGraphToMermaid(graph: FormRelationshipGraph): string {
  if (graph.nodes.length === 0) return '';

  const labelById = new Map(graph.nodes.map(node => [node.id, node.label]));
  const lines = ['flowchart TB'];

  for (const node of graph.nodes) {
    const label = sanitizeMermaidText(labelById.get(node.id) ?? node.id);
    lines.push(`  ${mermaidNodeId(node.id)}["${label}"]`);
  }

  for (const edge of graph.edges) {
    if (!labelById.has(edge.from)) {
      const label = sanitizeMermaidText(edge.from);
      labelById.set(edge.from, edge.from);
      lines.push(`  ${mermaidNodeId(edge.from)}["${label}"]`);
    }
    if (!labelById.has(edge.to)) {
      const label = sanitizeMermaidText(edge.to);
      labelById.set(edge.to, edge.to);
      lines.push(`  ${mermaidNodeId(edge.to)}["${label}"]`);
    }
    lines.push(
      `  ${mermaidNodeId(edge.from)} -->|"${formatEdgeLabel(edge)}"| ${mermaidNodeId(edge.to)}`
    );
  }

  return lines.join('\n');
}
