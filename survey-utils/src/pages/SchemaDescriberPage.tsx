import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { parseSpecFile } from '../specParser';
import { buildExportData, exportJson, exportCsv, exportWord, exportWordDetailed } from '../exports';
import type { SpecReviewRow, SpecMetadata, UiSpecification } from '../types';
import { UploadPanel } from '../UploadPanel';
import { SummaryTable } from '../SummaryTable';

export function SchemaDescriberPage() {
  const [rows, setRows] = useState<SpecReviewRow[]>([]);
  const [metadata, setMetadata] = useState<SpecMetadata | undefined>(undefined);
  const [spec, setSpec] = useState<UiSpecification | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (!spec) return;
    const data = buildExportData(rows, metadata);
    await exportWordDetailed(data, spec);
  }, [rows, metadata, spec]);

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
          <button type="button" className="export-btn" onClick={handleExportJson}>
            JSON
          </button>
          <button type="button" className="export-btn" onClick={handleExportCsv}>
            CSV
          </button>
          <button type="button" className="export-btn" onClick={handleExportWordSummary}>
            Summary (Word)
          </button>
          <button type="button" className="export-btn" onClick={handleExportWordDetailed}>
            Detailed review (Word)
          </button>
        </section>
      )}
      <SummaryTable rows={rows} />
    </div>
  );
}
