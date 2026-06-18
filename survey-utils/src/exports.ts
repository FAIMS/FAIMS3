import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  AlignmentType,
  HeadingLevel,
  TextRun,
  ImageRun,
} from 'docx';
import type { FieldPreviewCapture } from './fieldPreview/captureFieldPreview';
import type { FieldPreviewResult } from './fieldPreview/fieldPreviewTypes';
import { type DiagramImage } from './formGraph/captureFormGraphImage';
import type { FormGraphEdge, FormRelationshipGraph } from './formGraph/buildFormRelationshipGraph';
import type { SpecReviewRow, SpecExportData, NotebookMetadata, UiSpecification, FieldSpec } from './types';
import type { SurveyDiffResult } from './surveyDiff';
import { surveyDiffToMarkdown, formatSelectOptionLine } from './surveyDiff';
import {
  getOrderedViewsetIds,
  normalizeViewIdList,
  getViewsMap,
  getLabel,
  getPrimaryHelperText,
  flattenOptionTree,
} from './specParser';

/** Extra space after headings (twips; 240 ≈ 12pt) */
const SPACING_AFTER_HEADING = 280;
/** Space after body paragraphs */
const SPACING_AFTER_PARAGRAPH = 120;

/** Build export data (rows + metadata + timestamp) */
export function buildExportData(
  rows: SpecReviewRow[],
  metadata?: NotebookMetadata
): SpecExportData {
  return {
    metadata,
    rows: rows.map(r => ({ ...r, notes: r.notes ?? '' })),
    exportedAt: new Date().toISOString(),
  };
}

/** Trigger download of a blob as a file */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export table as JSON */
export function exportJson(data: SpecExportData) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const name = (data.metadata?.information?.projectLeadLabel ?? 'survey-spec') + '-review.json';
  downloadBlob(blob, name.replace(/[^\w.-]/g, '_'));
}

/** Export table as CSV (with Notes column) */
export function exportCsv(data: SpecExportData) {
  const headers = ['Question', 'Form', 'Section', 'Type of question', 'Question content', 'Notes'];
  const escape = (s: string) => {
    const t = String(s ?? '').replace(/"/g, '""');
    return t.includes(',') || t.includes('"') || t.includes('\n') ? `"${t}"` : t;
  };
  const rows = data.rows.map(r =>
    [r.questionTitle, r.form, r.section, r.questionType, r.questionContent, r.notes ?? ''].map(escape).join(',')
  );
  const csv = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const name = (data.metadata?.information?.projectLeadLabel ?? 'survey-spec') + '-review.csv';
  downloadBlob(blob, name.replace(/[^\w.-]/g, '_'));
}

/** Fields shown in the Word metadata block, mapped from the v5.0 NotebookInformation shape. */
const METADATA_FIELDS: Array<{ key: 'projectLeadLabel' | 'leadInstitution' | 'purposeMarkdown' | 'notebookVersion'; label: string }> = [
  { key: 'projectLeadLabel', label: 'Project lead' },
  { key: 'leadInstitution', label: 'Lead institution' },
  { key: 'notebookVersion', label: 'Notebook version' },
  { key: 'purposeMarkdown', label: 'Description' },
];

/** Build form → sections → question count from rows */
function buildFormSectionCounts(rows: SpecReviewRow[]): {
  formOrder: string[];
  formSections: Map<string, Array<{ section: string; count: number }>>;
  totalSections: number;
  totalQuestions: number;
} {
  const formOrder: string[] = [];
  const seenForms = new Set<string>();
  const formSections = new Map<string, Array<{ section: string; count: number }>>();

  for (const r of rows) {
    if (!seenForms.has(r.form)) {
      seenForms.add(r.form);
      formOrder.push(r.form);
    }
    const list = formSections.get(r.form) ?? [];
    const existing = list.find(x => x.section === r.section);
    if (existing) existing.count += 1;
    else list.push({ section: r.section, count: 1 });
    formSections.set(r.form, list);
  }

  let totalSections = 0;
  for (const list of formSections.values()) totalSections += list.length;

  return {
    formOrder,
    formSections,
    totalSections,
    totalQuestions: rows.length,
  };
}

/** Shared top of Word exports: metadata block + forms/sections summary table */
function buildWordPreambleChildren(data: SpecExportData): (Paragraph | Table)[] {
  const { metadata, rows } = data;
  const sectionChildren: (Paragraph | Table)[] = [];

  if (metadata && typeof metadata === 'object') {
    sectionChildren.push(
      new Paragraph({
        text: 'Survey / notebook details',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: SPACING_AFTER_HEADING },
      })
    );
    const info = metadata.information;
    if (info && typeof info === 'object') {
      for (const { key, label } of METADATA_FIELDS) {
        const value = info[key];
        if (value != null && value !== '') {
          sectionChildren.push(
            new Paragraph({
              spacing: { after: SPACING_AFTER_PARAGRAPH },
              children: [
                new TextRun({ text: `${label}: `, bold: true }),
                new TextRun({ text: String(value) }),
              ],
            })
          );
        }
      }
    }
    sectionChildren.push(new Paragraph({ text: '', spacing: { after: SPACING_AFTER_PARAGRAPH } }));
  }

  const { formOrder, formSections, totalSections, totalQuestions } = buildFormSectionCounts(rows);
  sectionChildren.push(
    new Paragraph({
      text: 'Forms and sections',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: SPACING_AFTER_HEADING },
    })
  );
  sectionChildren.push(
    new Paragraph({
      text: `There are ${formOrder.length} form${formOrder.length === 1 ? '' : 's'}.`,
      spacing: { after: SPACING_AFTER_PARAGRAPH },
    })
  );

  const countTableRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: ['Form', 'Section', 'Questions'].map(
        text =>
          new TableCell({
            children: [new Paragraph({ text, alignment: AlignmentType.CENTER })],
            shading: { fill: 'E8E8E8' },
          })
      ),
    }),
  ];
  for (const formName of formOrder) {
    const sections = formSections.get(formName) ?? [];
    sections.forEach((s, i) => {
      countTableRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph(i === 0 ? formName : '')],
            }),
            new TableCell({
              children: [new Paragraph(s.section)],
            }),
            new TableCell({
              children: [new Paragraph(String(s.count))],
            }),
          ],
        })
      );
    });
  }
  countTableRows.push(
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Total', bold: true })] })],
        }),
        new TableCell({
          children: [new Paragraph(`${totalSections} section${totalSections === 1 ? '' : 's'}`)],
        }),
        new TableCell({
          children: [
            new Paragraph({ children: [new TextRun({ text: String(totalQuestions), bold: true })] }),
          ],
        }),
      ],
    })
  );

  const countTable = new Table({
    width: { size: 60, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, size: 1 },
    },
    rows: countTableRows,
  });

  sectionChildren.push(countTable);
  sectionChildren.push(new Paragraph({ text: '', spacing: { after: SPACING_AFTER_HEADING } }));

  return sectionChildren;
}

function tableBorder() {
  return {
    top: { style: BorderStyle.SINGLE, size: 1 },
    bottom: { style: BorderStyle.SINGLE, size: 1 },
    left: { style: BorderStyle.SINGLE, size: 1 },
    right: { style: BorderStyle.SINGLE, size: 1 },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
    insideVertical: { style: BorderStyle.SINGLE, size: 1 },
  } as const;
}

/** Summary Word doc: preamble + flat question table (same as historical export) */
export async function buildWordDocument(data: SpecExportData): Promise<Blob> {
  const { rows } = data;
  const sectionChildren: (Paragraph | Table)[] = [...buildWordPreambleChildren(data)];

  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: [
        'Question',
        'Form',
        'Section',
        'Type of question',
        'Question content',
        'Notes',
      ].map(
        text =>
          new TableCell({
            children: [new Paragraph({ text, alignment: AlignmentType.CENTER })],
            shading: { fill: 'E8E8E8' },
          })
      ),
    }),
    ...rows.map(
      r =>
        new TableRow({
          children: [
            r.questionTitle,
            r.form,
            r.section,
            r.questionType,
            r.questionContent || '—',
            r.notes ?? '',
          ].map(
            text =>
              new TableCell({
                children: [new Paragraph({ text: String(text) })],
              })
          ),
        })
    ),
  ];

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorder(),
    rows: tableRows,
  });

  sectionChildren.push(
    new Paragraph({
      text: 'Question set for review',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: SPACING_AFTER_HEADING },
    })
  );
  sectionChildren.push(new Paragraph({ text: '', spacing: { after: SPACING_AFTER_PARAGRAPH } }));
  sectionChildren.push(table);

  const doc = new Document({
    sections: [{ properties: {}, children: sectionChildren }],
  });

  return Packer.toBlob(doc);
}

/** Regex that matches a base64 data URI anywhere in a string (image, font, any MIME). */
const DATA_URI_RE = /data:[a-z][a-z0-9!#$&\-^_]*\/[a-z0-9!#$&\-^_+.]*;base64,[A-Za-z0-9+/=]+/gi;

/** Strip HTML/Markdown-ish content to plain text for Word (images and data URIs → placeholder) */
function stripHtmlToPlainText(html: string): string {
  let s = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  // Strip img tags before generic tag removal; catches both <img …> and <img …/>
  s = s.replace(/<img[\s\S]*?>/gi, '[image]');
  // Strip any remaining bare data URIs (e.g. in src="" that survived or in attributes)
  s = s.replace(DATA_URI_RE, '[image]');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

function normalizeBlockContent(raw: string): string {
  let t = raw.trim();
  if (!t) return '';
  // Strip markdown-style images: ![alt](url) — catches data URIs and regular URLs
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, '[image]');
  // Strip any bare data URIs remaining outside of HTML/markdown constructs
  t = t.replace(DATA_URI_RE, '[image]');
  if (t.includes('<')) return stripHtmlToPlainText(t);
  return t;
}

/** `Label: value` with no character-level bold (used in detailed review body lines) */
function plainLabelLineParagraph(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: SPACING_AFTER_PARAGRAPH },
    children: [
      new TextRun({ text: `${label}: ` }),
      new TextRun({ text: value }),
    ],
  });
}

function monoBlockParagraphs(heading: string, body: string): Paragraph[] {
  const plain = body.trim();
  if (!plain) return [];
  const lines = plain.split('\n');
  return [
    new Paragraph({
      children: [new TextRun({ text: `${heading}:` })],
      spacing: { after: 80 },
    }),
    ...lines.map(
      line =>
        new Paragraph({
          shading: { fill: 'F0F0F0' },
          spacing: { after: 60 },
          indent: { left: 360 },
          children: [new TextRun({ text: line || ' ', font: 'Courier New', size: 20 })],
        })
    ),
  ];
}

function relatedRecordTargetLine(spec: UiSpecification, relatedType: string): string {
  const vs = spec.viewsets[relatedType];
  const label = vs?.label ?? relatedType;
  return `${label} (viewset: ${relatedType})`;
}

/**
 * Format a ConditionalExpression into a compact, human-readable string.
 * Handles both compound (operator + conditions[]) and leaf (operator + field + value) nodes.
 */
function formatConditionExpr(expr: unknown, depth = 0): string {
  if (!expr || typeof expr !== 'object' || Array.isArray(expr)) return String(expr ?? '');
  const e = expr as Record<string, unknown>;
  const op = typeof e.operator === 'string' ? e.operator : '?';
  const opUpper = op.toUpperCase();

  // Compound: AND / OR over child conditions
  if (Array.isArray(e.conditions) && e.conditions.length > 0) {
    const parts = e.conditions.map((c: unknown) => formatConditionExpr(c, depth + 1));
    const joined = parts.join(` ${opUpper} `);
    return depth > 0 ? `(${joined})` : joined;
  }

  // Leaf: comparison against a field
  const field = typeof e.field === 'string' ? e.field : '?';
  const value = e.value;
  const valueStr =
    value === null || value === undefined
      ? 'empty'
      : typeof value === 'string'
        ? `"${value}"`
        : Array.isArray(value)
          ? `[${value.map(v => (typeof v === 'string' ? `"${v}"` : String(v))).join(', ')}]`
          : String(value);

  // Map common operators to readable symbols / phrases
  const opMap: Record<string, string> = {
    equal: '=',
    equals: '=',
    '==': '=',
    'not-equal': '≠',
    notEqual: '≠',
    '!=': '≠',
    greater: '>',
    greaterThan: '>',
    less: '<',
    lessThan: '<',
    greaterOrEqual: '≥',
    lessOrEqual: '≤',
    contains: 'contains',
    startsWith: 'starts with',
    endsWith: 'ends with',
    in: 'in',
    notIn: 'not in',
    truthy: 'is truthy',
    falsy: 'is falsy',
    set: 'is set',
    notSet: 'is not set',
    exists: 'exists',
    notExists: 'does not exist',
    checked: 'is checked',
    unchecked: 'is unchecked',
  };
  const readable = opMap[op] ?? op;

  if (['truthy', 'falsy', 'set', 'notSet', 'exists', 'notExists', 'checked', 'unchecked'].includes(op)) {
    return `${field} ${readable}`;
  }
  return `${field} ${readable} ${valueStr}`;
}

function buildOptionsParagraphs(field: FieldSpec): Paragraph[] {
  const el = field['component-parameters']?.ElementProps;
  const out: Paragraph[] = [];
  if (!el) return out;

  if (el.options?.length) {
    out.push(
      new Paragraph({
        children: [new TextRun({ text: 'Options:' })],
        spacing: { after: 80 },
      })
    );
    for (const opt of el.options) {
      const text = opt.label ?? opt.value;
      if (text) out.push(new Paragraph({ text: `• ${text}`, spacing: { after: 40 } }));
    }
    if (el.enableOtherOption) {
      out.push(new Paragraph({ text: '• Other (free text)', spacing: { after: 80 } }));
    }
  } else if (el.optiontree?.length) {
    out.push(
      new Paragraph({
        children: [new TextRun({ text: 'Options (tree):' })],
        spacing: { after: 80 },
      })
    );
    for (const line of flattenOptionTree(el.optiontree)) {
      out.push(new Paragraph({ text: line, spacing: { after: 40 } }));
    }
  }
  return out;
}

const WORD_DIAGRAM_MAX_WIDTH = 520;

function buildDiagramParagraph(diagram: DiagramImage): Paragraph {
  const scale = diagram.width > WORD_DIAGRAM_MAX_WIDTH ? WORD_DIAGRAM_MAX_WIDTH / diagram.width : 1;
  const width = Math.round(diagram.width * scale);
  const height = Math.round(diagram.height * scale);
  return new Paragraph({
    spacing: { after: SPACING_AFTER_PARAGRAPH },
    children: [
      new ImageRun({
        type: 'png',
        data: diagram.data,
        transformation: { width, height },
      }),
    ],
  });
}

const WORD_PREVIEW_MAX_WIDTH = 480;

function relationLabelForExport(edge: FormGraphEdge): string {
  return edge.relationType === 'faims-core::Child'
    ? 'has child'
    : edge.relationType === 'faims-core::Linked'
      ? 'linked'
      : edge.relationType.replace(/^faims-core::/, '');
}

function buildFormRelationshipTable(graph: FormRelationshipGraph): Table {
  const labelById = new Map(graph.nodes.map(node => [node.id, node.label]));
  const rows = [
    new TableRow({
      tableHeader: true,
      children: ['From form', 'Relationship', 'To form'].map(
        text =>
          new TableCell({
            children: [new Paragraph({ text, alignment: AlignmentType.CENTER })],
            shading: { fill: 'E8E8E8' },
          })
      ),
    }),
    ...graph.edges.map(
      edge =>
        new TableRow({
          children: [
            labelById.get(edge.from) ?? edge.from,
            relationLabelForExport(edge),
            labelById.get(edge.to) ?? edge.to,
          ].map(
            text =>
              new TableCell({
                children: [new Paragraph({ text: String(text) })],
              })
          ),
        })
    ),
  ];

  return new Table({
    width: { size: 90, type: WidthType.PERCENTAGE },
    borders: tableBorder(),
    rows,
  });
}

function buildFormRelationshipGraphSection(
  diagram: DiagramImage | null,
  edgeCount: number,
  graph: FormRelationshipGraph
): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      text: 'Form relationships',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: SPACING_AFTER_HEADING },
    }),
    new Paragraph({
      text: `Related record fields connect ${edgeCount} relationship${edgeCount === 1 ? '' : 's'} between forms (parent/child and linked).`,
      spacing: { after: SPACING_AFTER_PARAGRAPH },
    }),
  ];

  if (diagram) {
    children.push(buildDiagramParagraph(diagram));
  } else {
    children.push(
      plainLabelLineParagraph(
        'Diagram image',
        'Could not render — relationship table below.'
      )
    );
    children.push(
      new Paragraph({
        text: '',
        spacing: { after: SPACING_AFTER_PARAGRAPH },
      })
    );
    children.push(buildFormRelationshipTable(graph));
  }

  children.push(new Paragraph({ text: '', spacing: { after: SPACING_AFTER_HEADING } }));
  return children;
}


function buildFieldPreviewParagraph(preview: FieldPreviewCapture): Paragraph {
  const scale = preview.width > WORD_PREVIEW_MAX_WIDTH ? WORD_PREVIEW_MAX_WIDTH / preview.width : 1;
  const width = Math.round(preview.width * scale);
  const height = Math.round(preview.height * scale);
  return new Paragraph({
    spacing: { after: SPACING_AFTER_PARAGRAPH },
    children: [
      new ImageRun({
        type: 'png',
        data: preview.data,
        transformation: { width, height },
      }),
    ],
  });
}

function buildDetailedQuestionParagraphs(
  spec: UiSpecification,
  fieldName: string,
  field: FieldSpec,
  options?: { preview?: FieldPreviewResult; includePreviews?: boolean }
): Paragraph[] {
  const params = field['component-parameters'];
  const titleLabel = params ? getLabel(params) || fieldName : fieldName;
  const paras: Paragraph[] = [];

  paras.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_4,
      spacing: { before: 280, after: 120 },
      children: [
        new TextRun({
          text: titleLabel,
          bold: true,
          italics: false,
        }),
      ],
    })
  );

  if (options?.includePreviews && options.preview?.status === 'image') {
    paras.push(buildFieldPreviewParagraph(options.preview.capture));
  }

  // Required / optional
  const isRequired = params?.required === true;
  paras.push(
    plainLabelLineParagraph('Required', isRequired ? 'Yes' : 'No')
  );

  // Map field: geometry type
  if (field['component-name'] === 'MapFormField') {
    const featureTypeLabels: Record<string, string> = {
      Point: 'Point',
      LineString: 'Line (LineString)',
      Polygon: 'Polygon',
    };
    const ft = typeof params?.featureType === 'string' ? params.featureType : 'Point';
    paras.push(plainLabelLineParagraph('Geometry type', featureTypeLabels[ft] ?? ft));
  }

  // Primary helper text
  const helper = params ? getPrimaryHelperText(params) : '';
  if (helper.trim()) {
    paras.push(plainLabelLineParagraph('Helper text', helper));
  }

  // Advanced helper text (directly after primary helper so both helpers are grouped)
  const adv = params?.advancedHelperText;
  if (typeof adv === 'string' && adv.trim()) {
    paras.push(...monoBlockParagraphs('Advanced helper text', normalizeBlockContent(adv)));
  }

  paras.push(...buildOptionsParagraphs(field));

  // Condition
  const condition = field.condition;
  if (condition != null) {
    const condStr = formatConditionExpr(condition);
    if (condStr.trim()) {
      paras.push(plainLabelLineParagraph('Visible when', condStr));
    }
  }

  paras.push(
    plainLabelLineParagraph('Component', field['component-name'] ?? '—')
  );

  const staticContent = params?.content;
  if (typeof staticContent === 'string' && staticContent.trim()) {
    paras.push(
      ...monoBlockParagraphs('Static / default content', normalizeBlockContent(staticContent))
    );
  }

  const relatedType =
    params && typeof params.related_type === 'string' ? params.related_type.trim() : '';
  if (relatedType) {
    paras.push(
      plainLabelLineParagraph('Related record target', relatedRecordTargetLine(spec, relatedType))
    );
    const relKind = params.relation_type;
    if (typeof relKind === 'string' && relKind.trim()) {
      paras.push(plainLabelLineParagraph('Relationship type', relKind));
    }
  }

  return paras;
}

export interface WordDetailedExportOptions {
  /** Map of field name → preview capture result. */
  fieldPreviews?: Map<string, FieldPreviewResult>;
  /** Rendered Mermaid form-relationship diagram (image may be null if capture failed). */
  formRelationshipDiagram?: {
    diagram: DiagramImage | null;
    edgeCount: number;
    graph: FormRelationshipGraph;
  } | null;
}

/** Detailed Word doc: preamble + per-form / per-section / per-field narrative */
export async function buildWordDetailedDocument(
  data: SpecExportData,
  spec: UiSpecification,
  options?: WordDetailedExportOptions
): Promise<Blob> {
  const sectionChildren: (Paragraph | Table)[] = [...buildWordPreambleChildren(data)];
  const includePreviews = Boolean(options?.fieldPreviews);
  const relationship = options?.formRelationshipDiagram;

  if (relationship) {
    sectionChildren.push(
      ...buildFormRelationshipGraphSection(
        relationship.diagram,
        relationship.edgeCount,
        relationship.graph
      )
    );
  }

  sectionChildren.push(
    new Paragraph({
      text: 'Detailed field review',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: SPACING_AFTER_HEADING },
    })
  );
  sectionChildren.push(
    new Paragraph({
      text: includePreviews
        ? 'Each form and section below lists fields in order with a preview screenshot. Rich HTML in metadata is reduced to plain text; images in helper text are omitted as [image].'
        : 'Each form and section below lists fields in order. Rich HTML is reduced to plain text; images are omitted as [image].',
      spacing: { after: SPACING_AFTER_PARAGRAPH },
    })
  );

  const views = getViewsMap(spec);
  const viewsetIds = getOrderedViewsetIds(spec);

  for (const viewsetId of viewsetIds) {
    const viewset = spec.viewsets[viewsetId];
    const viewIds = normalizeViewIdList(viewset?.views);
    if (!viewset || viewIds.length === 0) continue;

    const formHeading = viewset.label ?? viewsetId;
    sectionChildren.push(
      new Paragraph({
        text: formHeading,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 360, after: SPACING_AFTER_HEADING },
      })
    );

    for (const viewId of viewIds) {
      const view = views[viewId];
      if (!view) continue;
      const sectionHeading = view.label ?? viewId;
      sectionChildren.push(
        new Paragraph({
          text: sectionHeading,
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: SPACING_AFTER_HEADING },
        })
      );

      // Section-level visibility condition
      const sectionCondition = (spec.views[viewId] as Record<string, unknown>)?.condition;
      if (sectionCondition != null) {
        const condStr = formatConditionExpr(sectionCondition);
        if (condStr.trim()) {
          sectionChildren.push(
            new Paragraph({
              spacing: { after: SPACING_AFTER_PARAGRAPH },
              children: [
                new TextRun({ text: 'Section visible when: ', bold: true, italics: true }),
                new TextRun({ text: condStr, italics: true }),
              ],
            })
          );
        }
      }

      for (const fname of view.fields) {
        const field = spec.fields[fname];
        if (!field) continue;
        sectionChildren.push(
          ...buildDetailedQuestionParagraphs(spec, fname, field, {
            includePreviews,
            preview: options?.fieldPreviews?.get(fname),
          })
        );
      }
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children: sectionChildren }],
  });

  return Packer.toBlob(doc);
}

/** Summary table Word export (historical behaviour; filename *-review.docx) */
export async function exportWord(data: SpecExportData) {
  const blob = await buildWordDocument(data);
  const name = (data.metadata?.information?.projectLeadLabel ?? 'survey-spec') + '-review.docx';
  downloadBlob(blob, name.replace(/[^\w.-]/g, '_'));
}

/** Detailed narrative Word export */
export async function exportWordDetailed(
  data: SpecExportData,
  spec: UiSpecification,
  options?: WordDetailedExportOptions
) {
  const blob = await buildWordDetailedDocument(data, spec, options);
  const name = (data.metadata?.information?.projectLeadLabel ?? 'survey-spec') + '-review-detailed.docx';
  downloadBlob(blob, name.replace(/[^\w.-]/g, '_'));
}

function formatDiffValuePlain(v: unknown): string {
  if (v === undefined) return '—';
  if (v === null) return 'null';
  if (typeof v === 'string') return v.length > 400 ? v.slice(0, 400) + '…' : v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Word document: survey diff change summary (mirrors markdown structure) */
export async function buildSurveyDiffWordDocument(
  result: SurveyDiffResult,
  title = 'Survey specification changes'
): Promise<Blob> {
  const children: Paragraph[] = [
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: SPACING_AFTER_HEADING },
    }),
    new Paragraph({
      spacing: { after: SPACING_AFTER_PARAGRAPH },
      children: [new TextRun({ text: `Generated: ${result.generatedAt}`, italics: true })],
    }),
  ];

  let anyChange = false;
  for (const form of result.forms) {
    if (form.status === 'unchanged') continue;
    anyChange = true;

    const formLine =
      form.status === 'added'
        ? `Form added: ${form.displayRight} (${form.formId})`
        : form.status === 'removed'
          ? `Form removed: ${form.displayLeft} (${form.formId})`
          : `Form modified: ${form.displayLeft} → ${form.displayRight} (${form.formId})`;

    children.push(
      new Paragraph({
        text: formLine,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: SPACING_AFTER_HEADING },
      })
    );

    if (form.metaChanges?.length) {
      children.push(
        new Paragraph({
          text: 'Viewset metadata',
          heading: HeadingLevel.HEADING_3,
          spacing: { after: 120 },
        })
      );
      for (const c of form.metaChanges) {
        children.push(
          new Paragraph({
            spacing: { after: SPACING_AFTER_PARAGRAPH },
            children: [
              new TextRun({ text: `${c.path}: `, bold: true }),
              new TextRun({ text: `${formatDiffValuePlain(c.before)} → ${formatDiffValuePlain(c.after)}` }),
            ],
          })
        );
      }
    }
    if (form.sectionOrderChanged) {
      children.push(
        new Paragraph({
          text: 'Section order changed within this form.',
          spacing: { after: SPACING_AFTER_PARAGRAPH },
        })
      );
    }

    for (const sec of form.sections) {
      if (sec.status === 'unchanged') continue;

      const secLine =
        sec.status === 'added'
          ? `Section added: ${sec.displayRight} (${sec.sectionId})`
          : sec.status === 'removed'
            ? `Section removed: ${sec.displayLeft} (${sec.sectionId})`
            : `Section: ${sec.displayLeft} / ${sec.displayRight} (${sec.sectionId})`;

      children.push(
        new Paragraph({
          text: secLine,
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 160, after: 120 },
        })
      );

      if (sec.metaChanges?.length) {
        for (const c of sec.metaChanges) {
          children.push(
            new Paragraph({
              spacing: { after: SPACING_AFTER_PARAGRAPH },
              children: [
                new TextRun({ text: `${c.path}: `, bold: true }),
                new TextRun({ text: `${formatDiffValuePlain(c.before)} → ${formatDiffValuePlain(c.after)}` }),
              ],
            })
          );
        }
      }
      if (sec.fieldOrderChanged) {
        children.push(
          new Paragraph({
            text: 'Question order changed within this section.',
            spacing: { after: SPACING_AFTER_PARAGRAPH },
          })
        );
      }

      const added = sec.questions.filter(q => q.status === 'added');
      const removed = sec.questions.filter(q => q.status === 'removed');
      const modified = sec.questions.filter(q => q.status === 'modified');

      if (removed.length) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: 'Removed questions', bold: true })],
            spacing: { after: 80 },
          })
        );
        for (const q of removed) {
          children.push(
            new Paragraph({
              text: `• ${q.fieldId} — ${q.displayLeft}`,
              spacing: { after: 40 },
            })
          );
        }
      }
      if (added.length) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: 'Added questions', bold: true })],
            spacing: { after: 80 },
          })
        );
        for (const q of added) {
          children.push(
            new Paragraph({
              text: `• ${q.fieldId} — ${q.displayRight}`,
              spacing: { after: 40 },
            })
          );
        }
      }
      if (modified.length) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: 'Modified questions', bold: true })],
            spacing: { after: 80 },
          })
        );
        for (const q of modified) {
          children.push(
            new Paragraph({
              text: `${q.fieldId} — ${q.displayLeft} / ${q.displayRight}`,
              spacing: { after: 60 },
            })
          );
          if (q.selectOptionsDiff) {
            const d = q.selectOptionsDiff;
            const indent = 360;
            if (d.removed.length) {
              children.push(
                new Paragraph({
                  spacing: { after: 40 },
                  indent: { left: indent },
                  children: [new TextRun({ text: 'Select options removed:', bold: true })],
                })
              );
              for (const o of d.removed) {
                children.push(
                  new Paragraph({
                    spacing: { after: 30 },
                    indent: { left: indent + 240 },
                    text: `• ${formatSelectOptionLine(o)}`,
                  })
                );
              }
            }
            if (d.added.length) {
              children.push(
                new Paragraph({
                  spacing: { after: 40 },
                  indent: { left: indent },
                  children: [new TextRun({ text: 'Select options added:', bold: true })],
                })
              );
              for (const o of d.added) {
                children.push(
                  new Paragraph({
                    spacing: { after: 30 },
                    indent: { left: indent + 240 },
                    text: `• ${formatSelectOptionLine(o)}`,
                  })
                );
              }
            }
            if (d.modified.length) {
              children.push(
                new Paragraph({
                  spacing: { after: 40 },
                  indent: { left: indent },
                  children: [new TextRun({ text: 'Select options modified:', bold: true })],
                })
              );
              for (const { before, after } of d.modified) {
                children.push(
                  new Paragraph({
                    spacing: { after: 30 },
                    indent: { left: indent + 240 },
                    text: `${formatSelectOptionLine(before)} → ${formatSelectOptionLine(after)}`,
                  })
                );
              }
            }
            if (d.orderChanged) {
              children.push(
                new Paragraph({
                  spacing: { after: 40 },
                  indent: { left: indent },
                  text: 'Select option order changed (same options, different sequence).',
                })
              );
            }
          }
          if (q.changes?.length) {
            const slice = q.changes.slice(0, 20);
            for (const c of slice) {
              children.push(
                new Paragraph({
                  spacing: { after: 40 },
                  indent: { left: 360 },
                  children: [
                    new TextRun({ text: `${c.path}: `, bold: true }),
                    new TextRun({
                      text: `${formatDiffValuePlain(c.before)} → ${formatDiffValuePlain(c.after)}`,
                    }),
                  ],
                })
              );
            }
            if (q.changes.length > 20) {
              children.push(
                new Paragraph({
                  spacing: { after: 40 },
                  indent: { left: 360 },
                  children: [
                    new TextRun({
                      text: `…and ${q.changes.length - 20} more paths`,
                      italics: true,
                    }),
                  ],
                })
              );
            }
          }
        }
      }
    }
  }

  if (!anyChange) {
    children.push(
      new Paragraph({
        text: 'No structural or field-level differences detected.',
        spacing: { after: SPACING_AFTER_PARAGRAPH },
      })
    );
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });
  return Packer.toBlob(doc);
}

export async function exportSurveyDiffWord(result: SurveyDiffResult, filenameBase = 'survey-diff') {
  const blob = await buildSurveyDiffWordDocument(result);
  downloadBlob(blob, `${filenameBase.replace(/[^\w.-]/g, '_')}-summary.docx`);
}

export function exportSurveyDiffMarkdownFile(result: SurveyDiffResult, filenameBase = 'survey-diff') {
  const md = surveyDiffToMarkdown(result);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  downloadBlob(blob, `${filenameBase.replace(/[^\w.-]/g, '_')}-summary.md`);
}
