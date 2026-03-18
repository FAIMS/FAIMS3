import React from 'react';
import type { SpecReviewRow } from './types';

type Props = {
  rows: SpecReviewRow[];
};

export function SummaryTable({ rows }: Props) {
  if (rows.length === 0) return null;

  return (
    <section className="summary-section" aria-label="Question set summary">
      <div className="table-wrap">
        <table className="summary-table">
          <colgroup>
            <col className="col-field" />
            <col className="col-form" />
            <col className="col-section" />
            <col className="col-type" />
            <col className="col-content" />
            <col className="col-notes" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Field name</th>
              <th scope="col">Form</th>
              <th scope="col">Section</th>
              <th scope="col">Type of question</th>
              <th scope="col">Question content</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={`${row.fieldName}-${i}`}>
                <td className="cell-field">{row.fieldName}</td>
                <td className="cell-form">{row.form}</td>
                <td className="cell-section">{row.section}</td>
                <td className="cell-type">{row.questionType}</td>
                <td className="cell-content">
                  <pre className="content-pre">{row.questionContent || '—'}</pre>
                </td>
                <td className="cell-notes">{row.notes ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="table-meta">{rows.length} field(s) — suitable for review of question set</p>
    </section>
  );
}
