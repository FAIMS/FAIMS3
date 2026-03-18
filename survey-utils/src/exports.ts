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
import type { SpecReviewRow, SpecExportData, SpecMetadata } from './types';

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

/** Build a Word document with metadata at top and table (including Notes column) */
export async function buildWordDocument(data: SpecExportData): Promise<Blob> {
  const { metadata, rows } = data;

  const sectionChildren: (Paragraph | Table)[] = [];

  // Survey / notebook details: only name, project lead, lead institution, description
  if (metadata && typeof metadata === 'object') {
    sectionChildren.push(
      new Paragraph({
        text: 'Survey / notebook details',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: SPACING_AFTER_HEADING },
      })
    );
    for (const { key, label } of METADATA_KEYS) {
      const value = key === 'pre_description'
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

  // Counts: forms and sections in a table
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

  // Table: Form | Section | Questions
  const countTableRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: ['Form', 'Section', 'Questions'].map(text =>
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
          children: [new Paragraph({ children: [new TextRun({ text: String(totalQuestions), bold: true })] })],
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
          ].map(text => new TableCell({
            children: [new Paragraph({ text: String(text) })],
          })),
        })
    ),
  ];

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, size: 1 },
    },
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

  const buffer = await Packer.toBlob(doc);
  return buffer;
}

/** Export table as Word document and trigger download */
export async function exportWord(data: SpecExportData) {
  const blob = await buildWordDocument(data);
  const name = (data.metadata?.name ?? 'survey-spec') + '-review.docx';
  downloadBlob(blob, name.replace(/[^\w.-]/g, '_'));
}
