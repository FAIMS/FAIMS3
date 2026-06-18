import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { captureAllFieldPreviews } from '../fieldPreview/captureAllFieldPreviews';
import { buildFormRelationshipDiagram } from '../formGraph/buildFormRelationshipDiagram';
import { parseSpecFile } from '../specParser';
import { buildExportData, exportJson, exportCsv, exportWord, exportWordDetailed } from '../exports';
import type { SpecReviewRow, NotebookMetadata, UiSpecification } from '../types';
import { UploadPanel } from '../UploadPanel';
import { SummaryTable } from '../SummaryTable';

export function SchemaDescriberPage() {
  const [rows, setRows] = useState<SpecReviewRow[]>([]);
  const [metadata, setMetadata] = useState<NotebookMetadata | undefined>(undefined);
  const [spec, setSpec] = useState<UiSpecification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includePreviews, setIncludePreviews] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);

  const handleSpecLoaded = useCallback((content: string) => {
    if (!content.trim()) {
      setRows([]);
      setMetadata(undefined);
      setSpec(null);
      setError('Please upload a JSON file.');
      return;
    }
    const result = parseSpecFile(content);
    if (result.ok) {
      setRows(result.rows);
      setMetadata(result.metadata);
      setSpec(result.spec);
      setError(null);
    } else {
      setRows([]);
      setMetadata(undefined);
      setSpec(null);
      setError(result.error);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const handleExportJson = useCallback(() => {
    const data = buildExportData(rows, metadata);
    exportJson(data);
  }, [rows, metadata]);

  const handleExportCsv = useCallback(() => {
    const data = buildExportData(rows, metadata);
    exportCsv(data);
  }, [rows, metadata]);

  const handleExportWordSummary = useCallback(async () => {
    const data = buildExportData(rows, metadata);
    await exportWord(data);
  }, [rows, metadata]);

  const handleExportWordDetailed = useCallback(async () => {
    if (!spec || exporting) return;
    setExporting(true);
    setExportProgress(includePreviews ? 'Preparing export…' : null);
    try {
      const data = buildExportData(rows, metadata);
      const fieldPreviews = includePreviews
        ? await captureAllFieldPreviews(spec, (completed, total) => {
            setExportProgress(`Capturing field previews (${completed}/${total})…`);
          })
        : undefined;
      setExportProgress('Building form relationship diagram…');
      const formRelationshipResult = await buildFormRelationshipDiagram(spec);
      setExportProgress('Building Word document…');
      await exportWordDetailed(data, spec, {
        fieldPreviews,
        formRelationshipDiagram: formRelationshipResult,
      });
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  }, [rows, metadata, spec, includePreviews, exporting]);

  const hasData = rows.length > 0;

  return (
    <div className="app">
      <header className="header header-with-nav">
        <div className="header-top">
          <Link to="/" className="back-link">← Survey utilities</Link>
          <h1>Survey schema describer</h1>
        </div>
        <p>Upload a FAIMS UI specification (JSON) to get a tabular summary of the question set for review.</p>
      </header>
      <UploadPanel
        onSpecLoaded={handleSpecLoaded}
        error={error}
        clearError={clearError}
      />
      {hasData && (
        <section className="export-bar">
          <span className="export-label">Export:</span>
          <button type="button" className="export-btn" onClick={handleExportJson} disabled={exporting}>
            JSON
          </button>
          <button type="button" className="export-btn" onClick={handleExportCsv} disabled={exporting}>
            CSV
          </button>
          <button type="button" className="export-btn" onClick={handleExportWordSummary} disabled={exporting}>
            Summary (Word)
          </button>
          <label className="export-preview-toggle">
            <input
              type="checkbox"
              checked={includePreviews}
              onChange={e => setIncludePreviews(e.target.checked)}
              disabled={exporting}
            />
            Include field previews
          </label>
          <button
            type="button"
            className="export-btn"
            onClick={handleExportWordDetailed}
            disabled={exporting}
          >
            {exporting ? 'Exporting…' : 'Detailed review (Word)'}
          </button>
          {exportProgress && <span className="export-progress">{exportProgress}</span>}
        </section>
      )}
      <SummaryTable rows={rows} />
    </div>
  );
}
