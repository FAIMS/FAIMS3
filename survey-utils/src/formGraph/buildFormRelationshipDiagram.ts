import type { UiSpecification } from '../types';
import {
  buildFormRelationshipGraph,
  type FormRelationshipGraph,
} from './buildFormRelationshipGraph';
import { captureFormGraphImage, type DiagramImage } from './captureFormGraphImage';
import { formGraphToMermaid } from './formGraphToMermaid';

export type FormRelationshipDiagramResult = {
  diagram: DiagramImage | null;
  edgeCount: number;
  graph: FormRelationshipGraph;
};

/** Build the form graph and rasterize to PNG for Word embedding. */
export async function buildFormRelationshipDiagram(
  spec: UiSpecification
): Promise<FormRelationshipDiagramResult | null> {
  const graph = buildFormRelationshipGraph(spec);
  if (graph.edges.length === 0) return null;

  const mermaidSource = formGraphToMermaid(graph);
  if (!mermaidSource) return null;

  const diagram = await captureFormGraphImage(mermaidSource);
  return {
    diagram,
    edgeCount: graph.edges.length,
    graph,
  };
}
