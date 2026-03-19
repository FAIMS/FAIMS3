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
} from 'docx';
import type { SpecReviewRow, SpecExportData, SpecMetadata, UiSpecification, FieldSpec } from './types';
import {
  getOrderedViewsetIds,
  normalizeViewIdList,
  getViewsMap,
  getLabel,
  getPrimaryHelperText,
  flattenOptionTree,
  getFieldTypeLabel,
} from './specParser';

/** Extra space after headings (twips; 240 ≈ 12pt) */
const SPACING_AFTER_HEADING = 280;
/** Space after body paragraphs */
const SPACING_AFTER_PARAGRAPH = 120;

/** Build export data (rows + metadata + timestamp) */
export function buildExportData(
  rows: SpecReviewRow[],
  metadata?: SpecMetadata
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
  const name = (data.metadata?.name ?? 'survey-spec') + '-review.json';
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
  const name = (data.metadata?.name ?? 'survey-spec') + '-review.csv';
  downloadBlob(blob, name.replace(/[^\w.-]/g, '_'));
}

/** Keys we show in the Word metadata block (only these four, with pre_description → Description) */
const METADATA_KEYS: Array<{ key: keyof SpecMetadata; label: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'project_lead', label: 'Project lead' },
  { key: 'lead_institution', label: 'Lead institution' },
  { key: 'pre_description', label: 'Description' },
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
    for (const { key, label } of METADATA_KEYS) {
      const value =
        key === 'pre_description'
          ? (metadata.pre_description ?? metadata.description)
          : metadata[key];
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

/** Strip HTML/Markdown-ish content to plain text for Word (images → placeholder) */
function stripHtmlToPlainText(html: string): string {
  let s = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<img[^>]*>/gi, '[image]');
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
  const t = raw.trim();
  if (!t) return '';
  if (t.includes('<')) return stripHtmlToPlainText(t);
  return t;
}

function labelValueParagraph(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: SPACING_AFTER_PARAGRAPH },
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
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
      children: [new TextRun({ text: heading, bold: true })],
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

function buildOptionsParagraphs(field: FieldSpec): Paragraph[] {
  const el = field['component-parameters']?.ElementProps;
  const out: Paragraph[] = [];
  if (!el) return out;

  if (el.options?.length) {
    out.push(
      new Paragraph({
        children: [new TextRun({ text: 'Options', bold: true })],
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
        children: [new TextRun({ text: 'Options (tree)', bold: true })],
        spacing: { after: 80 },
      })
    );
    for (const line of flattenOptionTree(el.optiontree)) {
      out.push(new Paragraph({ text: line, spacing: { after: 40 } }));
    }
  }
  return out;
}

function buildDetailedQuestionParagraphs(
  spec: UiSpecification,
  fieldName: string,
  field: FieldSpec
): Paragraph[] {
  const params = field['component-parameters'];
  const titleLabel = params ? getLabel(params) || fieldName : fieldName;
  const paras: Paragraph[] = [];

  paras.push(
    new Paragraph({
      text: titleLabel,
      heading: HeadingLevel.HEADING_4,
      spacing: { before: 280, after: 80 },
    })
  );
  paras.push(
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: 'Field id: ', italics: true, color: '666666' }),
        new TextRun({ text: fieldName, italics: true, color: '666666' }),
      ],
    })
  );

  paras.push(labelValueParagraph('Type of question', getFieldTypeLabel(field)));
  paras.push(labelValueParagraph('Component', field['component-name'] ?? '—'));
  paras.push(labelValueParagraph('Title', titleLabel));

  const helper = params ? getPrimaryHelperText(params) : '';
  if (helper.trim()) {
    paras.push(labelValueParagraph('Helper text', helper));
  }

  const adv = params?.advancedHelperText;
  if (typeof adv === 'string' && adv.trim()) {
    paras.push(...monoBlockParagraphs('Advanced helper text', normalizeBlockContent(adv)));
  }

  const staticContent = params?.content;
  if (typeof staticContent === 'string' && staticContent.trim()) {
    paras.push(
      ...monoBlockParagraphs('Static / default content', normalizeBlockContent(staticContent))
    );
  }

  paras.push(...buildOptionsParagraphs(field));

  const relatedType =
    params && typeof params.related_type === 'string' ? params.related_type.trim() : '';
  if (relatedType) {
    paras.push(labelValueParagraph('Related record target', relatedRecordTargetLine(spec, relatedType)));
    const relKind = params.relation_type;
    if (typeof relKind === 'string' && relKind.trim()) {
      paras.push(labelValueParagraph('Relationship type', relKind));
    }
  }

  return paras;
}

/** Detailed Word doc: preamble + per-form / per-section / per-field narrative */
export async function buildWordDetailedDocument(data: SpecExportData, spec: UiSpecification): Promise<Blob> {
  const sectionChildren: (Paragraph | Table)[] = [...buildWordPreambleChildren(data)];

  sectionChildren.push(
    new Paragraph({
      text: 'Detailed field review',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: SPACING_AFTER_HEADING },
    })
  );
  sectionChildren.push(
    new Paragraph({
      text: 'Each form and section below lists fields in order. Rich HTML is reduced to plain text; images are omitted as [image].',
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

      for (const fname of view.fields) {
        const field = spec.fields[fname];
        if (!field) continue;
        sectionChildren.push(...buildDetailedQuestionParagraphs(spec, fname, field));
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
  const name = (data.metadata?.name ?? 'survey-spec') + '-review.docx';
  downloadBlob(blob, name.replace(/[^\w.-]/g, '_'));
}

/** Detailed narrative Word export */
export async function exportWordDetailed(data: SpecExportData, spec: UiSpecification) {
  const blob = await buildWordDetailedDocument(data, spec);
  const name = (data.metadata?.name ?? 'survey-spec') + '-review-detailed.docx';
  downloadBlob(blob, name.replace(/[^\w.-]/g, '_'));
}
