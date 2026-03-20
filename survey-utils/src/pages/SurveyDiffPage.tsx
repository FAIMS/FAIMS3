import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { parseSpecFile } from '../specParser';
import {
  computeSurveyDiff,
  surveyDiffToMarkdown,
  formatSelectOptionLine,
  type FormDiffNode,
  type QuestionDiffNode,
  type SectionDiffNode,
  type SelectOptionsSemanticDiff,
  type SurveyDiffResult,
} from '../surveyDiff';
import { exportSurveyDiffMarkdownFile, exportSurveyDiffWord } from '../exports';

function statusBadge(status: string): string {
  switch (status) {
    case 'added':
      return 'diff-badge diff-badge-added';
    case 'removed':
      return 'diff-badge diff-badge-removed';
    case 'modified':
      return 'diff-badge diff-badge-modified';
    default:
      return 'diff-badge diff-badge-unchanged';
  }
}

function formHasVisibleContent(form: FormDiffNode, hideUnchanged: boolean): boolean {
  if (!hideUnchanged) return true;
  if (form.status !== 'unchanged') return true;
  return form.sections.some(s => sectionHasVisibleContent(s, hideUnchanged));
}

function sectionHasVisibleContent(sec: SectionDiffNode, hideUnchanged: boolean): boolean {
  if (!hideUnchanged) return true;
  if (sec.status !== 'unchanged') return true;
  return sec.questions.some(q => q.status !== 'unchanged');
}

function SelectOptionsDiffBlock({ d }: { d: SelectOptionsSemanticDiff }) {
  return (
    <div className="diff-select-options">
      <div className="diff-select-options-title">Select options</div>
      {d.removed.length > 0 ? (
        <div className="diff-select-options-group diff-select-removed">
          <span className="diff-select-options-label">Removed</span>
          <ul>
            {d.removed.map((o, i) => (
              <li key={`r-${i}-${o.value}-${o.label}`}>{formatSelectOptionLine(o)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {d.added.length > 0 ? (
        <div className="diff-select-options-group diff-select-added">
          <span className="diff-select-options-label">Added</span>
          <ul>
            {d.added.map((o, i) => (
              <li key={`a-${i}-${o.value}-${o.label}`}>{formatSelectOptionLine(o)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {d.modified.length > 0 ? (
        <div className="diff-select-options-group diff-select-modified">
          <span className="diff-select-options-label">Modified</span>
          <ul>
            {d.modified.map((m, i) => (
              <li key={`m-${i}`}>
                <span className="diff-value diff-value-before">{formatSelectOptionLine(m.before)}</span>
                <span className="diff-arrow" aria-hidden>
                  {' '}
                  →{' '}
                </span>
                <span className="diff-value diff-value-after">{formatSelectOptionLine(m.after)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {d.orderChanged ? (
        <p className="diff-select-order-note">Option order changed (same options, different sequence).</p>
      ) : null}
    </div>
  );
}

function DiffValueChanges({ changes }: { changes: NonNullable<QuestionDiffNode['changes']> }) {
  const max = 12;
  const shown = changes.slice(0, max);
  return (
    <ul className="diff-value-list">
      {shown.map((c, i) => (
        <li key={`${c.path}-${i}`}>
          <code className="diff-path">{c.path}</code>
          <div className="diff-value-pair">
            <span className="diff-value diff-value-before">{String(JSON.stringify(c.before))}</span>
            <span className="diff-arrow" aria-hidden>
              →
            </span>
            <span className="diff-value diff-value-after">{String(JSON.stringify(c.after))}</span>
          </div>
        </li>
      ))}
      {changes.length > max ? (
        <li className="diff-more">…and {changes.length - max} more paths</li>
      ) : null}
    </ul>
  );
}

function QuestionRow({ q }: { q: QuestionDiffNode }) {
  return (
    <div className={`diff-question-row diff-status-${q.status}`}>
      <div className="diff-split-inner">
        <div className="diff-pane diff-pane-left">
          <span className="diff-id">{q.fieldId}</span>
          <span className="diff-label">{q.displayLeft}</span>
        </div>
        <div className="diff-pane diff-pane-right">
          <span className="diff-id">{q.fieldId}</span>
          <span className="diff-label">{q.displayRight}</span>
        </div>
      </div>
      {q.status === 'modified' && (q.selectOptionsDiff || q.changes?.length) ? (
        <div className="diff-question-detail">
          {q.selectOptionsDiff ? <SelectOptionsDiffBlock d={q.selectOptionsDiff} /> : null}
          {q.changes?.length ? <DiffValueChanges changes={q.changes} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function SectionBlock({
  sec,
  hideUnchanged,
}: {
  sec: SectionDiffNode;
  hideUnchanged: boolean;
}) {
  const visibleQs = hideUnchanged ? sec.questions.filter(q => q.status !== 'unchanged') : sec.questions;
  if (hideUnchanged && sec.status === 'unchanged' && visibleQs.length === 0) return null;

  const defaultOpen = sec.status !== 'unchanged';

  return (
    <details className="diff-layer diff-layer-section" open={defaultOpen}>
      <summary className="diff-summary">
        <span className="diff-summary-label">{sec.displayLeft}</span>
        <span className="diff-summary-sep" aria-hidden>
          |
        </span>
        <span className="diff-summary-label">{sec.displayRight}</span>
        <span className={statusBadge(sec.status)}>{sec.status}</span>
        {sec.fieldOrderChanged ? <span className="diff-hint">order changed</span> : null}
      </summary>
      <div className="diff-layer-body">
        {sec.metaChanges?.length ? (
          <div className="diff-meta-changes">
            <strong>Section metadata</strong>
            <DiffValueChanges changes={sec.metaChanges} />
          </div>
        ) : null}
        <div className="diff-column-headers" aria-hidden>
          <span>Before (left)</span>
          <span>After (right)</span>
        </div>
        {visibleQs.map(q => (
          <QuestionRow key={q.fieldId} q={q} />
        ))}
      </div>
    </details>
  );
}

function FormBlock({ form, hideUnchanged }: { form: FormDiffNode; hideUnchanged: boolean }) {
  if (!formHasVisibleContent(form, hideUnchanged)) return null;

  const sections = form.sections.filter(s => {
    if (!hideUnchanged) return true;
    return sectionHasVisibleContent(s, hideUnchanged);
  });

  const defaultOpen = form.status !== 'unchanged';

  return (
    <details className="diff-layer diff-layer-form" open={defaultOpen}>
      <summary className="diff-summary">
        <span className="diff-summary-label">{form.displayLeft}</span>
        <span className="diff-summary-sep" aria-hidden>
          |
        </span>
        <span className="diff-summary-label">{form.displayRight}</span>
        <span className={statusBadge(form.status)}>{form.status}</span>
        {form.sectionOrderChanged ? <span className="diff-hint">section order changed</span> : null}
      </summary>
      <div className="diff-layer-body">
        {form.metaChanges?.length ? (
          <div className="diff-meta-changes">
            <strong>Form (viewset) metadata</strong>
            <DiffValueChanges changes={form.metaChanges} />
          </div>
        ) : null}
        {sections.map(sec => (
          <SectionBlock key={sec.sectionId} sec={sec} hideUnchanged={hideUnchanged} />
        ))}
      </div>
    </details>
  );
}

type Side = 'left' | 'right';

function SideUpload({
  side,
  label,
  onLoad,
  error,
  fileName,
}: {
  side: Side;
  label: string;
  onLoad: (text: string, pickedName: string | null) => void;
  error: string | null;
  fileName: string | null;
}) {
  const [drag, setDrag] = useState(false);
  const inputId = `diff-file-${side}`;

  const readFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : '';
        onLoad(text, file.name ?? null);
      };
      reader.onerror = () => onLoad('', null);
      reader.readAsText(file, 'utf-8');
    },
    [onLoad]
  );

  return (
    <div className="diff-upload-cell">
      <h3 className="diff-upload-heading">{label}</h3>
      <div
        className={`drop-zone diff-drop-zone ${drag ? 'drag-over' : ''}`}
        onDrop={e => {
          e.preventDefault();
          setDrag(false);
          const file = e.dataTransfer.files?.[0];
          if (file) readFile(file);
        }}
        onDragOver={e => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={e => {
          e.preventDefault();
          setDrag(false);
        }}
      >
        <input
          type="file"
          accept=".json,application/json"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) readFile(file);
            e.target.value = '';
          }}
          id={inputId}
          className="file-input"
          aria-label={`Choose JSON for ${label}`}
        />
        <label htmlFor={inputId} className="drop-label">
          Drop or <span className="browse">browse</span> JSON
        </label>
      </div>
      {fileName ? <p className="diff-file-name">{fileName}</p> : null}
      {error ? (
        <p className="upload-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SurveyDiffPage() {
  const [leftContent, setLeftContent] = useState('');
  const [rightContent, setRightContent] = useState('');
  const [leftName, setLeftName] = useState<string | null>(null);
  const [rightName, setRightName] = useState<string | null>(null);
  const [leftError, setLeftError] = useState<string | null>(null);
  const [rightError, setRightError] = useState<string | null>(null);
  const [hideUnchanged, setHideUnchanged] = useState(true);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const leftParsed = useMemo(() => {
    if (!leftContent.trim()) return null;
    return parseSpecFile(leftContent);
  }, [leftContent]);

  const rightParsed = useMemo(() => {
    if (!rightContent.trim()) return null;
    return parseSpecFile(rightContent);
  }, [rightContent]);

  const diffResult: SurveyDiffResult | null = useMemo(() => {
    if (!leftParsed?.ok || !rightParsed?.ok) return null;
    return computeSurveyDiff(leftParsed.spec, rightParsed.spec);
  }, [leftParsed, rightParsed]);

  const markdown = useMemo(
    () => (diffResult ? surveyDiffToMarkdown(diffResult) : ''),
    [diffResult]
  );

  const handleLeft = useCallback((text: string, pickedName: string | null) => {
    setLeftContent(text);
    setLeftError(null);
    if (!text.trim()) {
      setLeftName(null);
      return;
    }
    const r = parseSpecFile(text);
    setLeftError(r.ok ? null : r.error);
    setLeftName(r.ok && pickedName ? pickedName : r.ok ? 'Valid JSON' : null);
  }, []);

  const handleRight = useCallback((text: string, pickedName: string | null) => {
    setRightContent(text);
    setRightError(null);
    if (!text.trim()) {
      setRightName(null);
      return;
    }
    const r = parseSpecFile(text);
    setRightError(r.ok ? null : r.error);
    setRightName(r.ok && pickedName ? pickedName : r.ok ? 'Valid JSON' : null);
  }, []);

  const copyMarkdown = useCallback(async () => {
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      /* ignore */
    }
  }, [markdown]);

  const downloadMd = useCallback(() => {
    if (!diffResult) return;
    const metaName = leftParsed?.ok && leftParsed.metadata?.name ? String(leftParsed.metadata.name) : '';
    const base = metaName ? `survey-diff-${metaName.slice(0, 48)}` : 'survey-diff';
    exportSurveyDiffMarkdownFile(diffResult, base.replace(/\s+/g, '-'));
  }, [diffResult, leftParsed]);

  const downloadWord = useCallback(async () => {
    if (!diffResult) return;
    await exportSurveyDiffWord(diffResult, 'survey-diff');
  }, [diffResult]);

  return (
    <div className="app diff-app">
      <header className="header header-with-nav">
        <div className="header-top">
          <Link to="/" className="back-link">
            ← Survey utilities
          </Link>
          <h1>Survey specification diff</h1>
        </div>
        <p>
          Compare two FAIMS UI specification JSON files side by side. Changes are grouped by form
          (viewset), section (view), and question (field), including metadata updates detected generically
          under each layer.
        </p>
      </header>

      <div className="diff-upload-row">
        <SideUpload
          side="left"
          label="Before (left)"
          onLoad={handleLeft}
          error={leftError}
          fileName={leftName}
        />
        <SideUpload
          side="right"
          label="After (right)"
          onLoad={handleRight}
          error={rightError}
          fileName={rightName}
        />
      </div>

      {diffResult ? (
        <>
          <section className="diff-toolbar" aria-label="Diff options">
            <label className="diff-toggle">
              <input
                type="checkbox"
                checked={hideUnchanged}
                onChange={e => setHideUnchanged(e.target.checked)}
              />
              Hide unchanged forms, sections, and questions
            </label>
            <div className="diff-toolbar-actions">
              <button type="button" className="export-btn" onClick={() => setSummaryOpen(o => !o)}>
                {summaryOpen ? 'Hide change summary' : 'Generate change summary'}
              </button>
            </div>
          </section>

          {summaryOpen ? (
            <section className="diff-summary-panel" aria-label="Change summary">
              <div className="diff-summary-actions">
                <button type="button" className="export-btn" onClick={copyMarkdown}>
                  Copy markdown
                </button>
                <button type="button" className="export-btn" onClick={downloadMd}>
                  Download .md
                </button>
                <button type="button" className="export-btn" onClick={downloadWord}>
                  Download Word
                </button>
              </div>
              <textarea
                className="diff-summary-textarea"
                readOnly
                value={markdown}
                rows={16}
                aria-label="Markdown change summary"
              />
            </section>
          ) : null}

          <section className="diff-tree-section" aria-label="Visual diff">
            {diffResult.forms.every(f => f.status === 'unchanged') && hideUnchanged ? (
              <p className="diff-empty-msg">
                Everything matches with current filters. Turn off &quot;Hide unchanged&quot; to browse the full
                tree.
              </p>
            ) : (
              diffResult.forms.map(form => (
                <FormBlock key={form.formId} form={form} hideUnchanged={hideUnchanged} />
              ))
            )}
          </section>
        </>
      ) : (
        <p className="diff-hint-block">
          Upload valid UI specifications on both sides to see the diff. Each file can be a full notebook JSON
          or a raw <code>ui-specification</code> object.
        </p>
      )}

    </div>
  );
}
