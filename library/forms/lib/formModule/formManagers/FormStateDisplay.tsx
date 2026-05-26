import {useState} from 'react';
import {useStore} from '@tanstack/react-form';
import {FaimsForm} from '../types';

interface FieldValue {
  data?: unknown;
  annotations?: Record<string, unknown>;
  attachments?: unknown[];
}

/**
 * Debug component that displays the current form values and errors.
 * Features a two-column layout with collapsible field details.
 */
export const FormStateDisplay = ({form}: {form: FaimsForm}) => {
  form.state.fieldMeta;
  const values = useStore(form.store, state => state.values);
  const fieldMeta = useStore(form.store, state => state.fieldMeta);
  const errors: Record<string, string[]> = {};
  for (const [k, meta] of Object.entries(fieldMeta)) {
    if (meta.errors.length > 0) {
      errors[k] = meta.errors as string[];
    }
  }
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  const toggleField = (key: string) => {
    setExpandedFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const fieldKeys = Object.keys(values);
  const errorList = parseErrors(errors);
  const hasErrors = errorList.length > 0;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerIcon}>🔍</span>
        <span style={styles.headerTitle}>Form Debug</span>
        <span style={styles.fieldCount}>{fieldKeys.length} fields</span>
        {hasErrors && (
          <span style={styles.errorBadge}>{errorList.length} errors</span>
        )}
      </div>

      <div style={styles.content}>
        {/* Left Column: Field Values */}
        <div style={styles.leftColumn}>
          <div style={styles.columnHeader}>Values</div>
          <div style={styles.fieldList}>
            {fieldKeys.map(key => (
              <FieldCard
                key={key}
                fieldKey={key}
                value={values[key] ?? {}}
                isExpanded={expandedFields.has(key)}
                onToggle={() => toggleField(key)}
                hasError={errorList.some(e => e.path.startsWith(key))}
              />
            ))}
            {fieldKeys.length === 0 && (
              <div style={styles.empty}>No fields yet</div>
            )}
          </div>
        </div>

        {/* Right Column: Errors */}
        <div style={styles.rightColumn}>
          <div style={styles.columnHeader}>
            Errors
            {hasErrors && <span style={styles.errorDot} />}
          </div>
          <div style={styles.errorList}>
            <ErrorDisplay errors={errorList} />
            {!hasErrors && (
              <div style={styles.noErrors}>
                <span style={styles.checkIcon}>✓</span>
                No validation errors
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface FieldCardProps {
  fieldKey: string;
  value: FieldValue;
  isExpanded: boolean;
  onToggle: () => void;
  hasError: boolean;
}

const FieldCard = ({
  fieldKey,
  value,
  isExpanded,
  onToggle,
  hasError,
}: FieldCardProps) => {
  const hasAnnotations =
    value.annotations && Object.keys(value.annotations).length > 0;
  const hasAttachments = value.attachments && value.attachments.length > 0;

  const dataPreview = getDataPreview(value.data);

  return (
    <div
      style={{...styles.fieldCard, ...(hasError ? styles.fieldCardError : {})}}
    >
      <div style={styles.fieldHeader} onClick={onToggle}>
        <span style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</span>
        <span style={styles.fieldKey}>{fieldKey}</span>
        <div style={styles.badges}>
          {hasAnnotations && <span style={styles.badge}>A</span>}
          {hasAttachments && (
            <span style={styles.badge}>📎{value.attachments!.length}</span>
          )}
        </div>
      </div>

      {!isExpanded && <div style={styles.dataPreview}>{dataPreview}</div>}

      {isExpanded && (
        <div style={styles.fieldDetails}>
          <DetailSection label="data" value={value.data} />
          {hasAnnotations && (
            <DetailSection label="annotations" value={value.annotations} />
          )}
          {hasAttachments && (
            <DetailSection label="attachments" value={value.attachments} />
          )}
        </div>
      )}
    </div>
  );
};

const DetailSection = ({label, value}: {label: string; value: unknown}) => (
  <div style={styles.detailSection}>
    <span style={styles.detailLabel}>{label}</span>
    <pre style={styles.detailValue}>{formatValue(value)}</pre>
  </div>
);

interface ParsedError {
  path: string;
  message: string;
  code?: string;
}

const ErrorCard = ({error}: {error: ParsedError}) => (
  <div style={styles.errorCard}>
    <div style={styles.errorPath}>{error.path || '(root)'}</div>
    <div style={styles.errorMessage}>{error.message}</div>
    {error.code && <span style={styles.errorCode}>{error.code}</span>}
  </div>
);

// Error display
const ErrorDisplay = ({errors}: {errors: ParsedError[]}) => {
  if (errors.length === 0) return null;

  return (
    <>
      {errors.map((error, idx) => (
        <ErrorCard key={idx} error={error} />
      ))}
    </>
  );
};

function parseErrors(errors: Record<string, string[]>): ParsedError[] {
  if (!errors) return [];
  const result: ParsedError[] = [];
  for (const [path, errorString] of Object.entries(errors)) {
    result.push({message: errorString.join(', '), path: path});
  }
  return result;
}

function getDataPreview(data: unknown): string {
  if (data === null) return 'null';
  if (data === undefined) return 'undefined';
  if (typeof data === 'string') {
    return data.length > 40 ? `"${data.slice(0, 40)}..."` : `"${data}"`;
  }
  if (typeof data === 'number' || typeof data === 'boolean') {
    return String(data);
  }
  if (Array.isArray(data)) {
    return `[${data.length} items]`;
  }
  if (typeof data === 'object') {
    const keys = Object.keys(data);
    return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`;
  }
  return String(data);
}

function formatValue(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 12,
    background: '#1e1e2e',
    color: '#cdd6f4',
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid #313244',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: '#181825',
    borderBottom: '1px solid #313244',
  },
  headerIcon: {
    fontSize: 14,
  },
  headerTitle: {
    fontWeight: 600,
    color: '#cba6f7',
  },
  fieldCount: {
    marginLeft: 'auto',
    color: '#6c7086',
    fontSize: 11,
  },
  errorBadge: {
    background: '#f38ba8',
    color: '#1e1e2e',
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 600,
  },
  content: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 1,
    background: '#313244',
  },
  leftColumn: {
    background: '#1e1e2e',
    height: 400,
    display: 'flex',
    flexDirection: 'column',
  },
  rightColumn: {
    background: '#1e1e2e',
    maxHeight: 400,
    display: 'flex',
    flexDirection: 'column',
  },
  columnHeader: {
    padding: '6px 12px',
    fontWeight: 600,
    color: '#89b4fa',
    background: '#181825',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    flexShrink: 0,
  },
  fieldList: {
    flex: 1,
    overflow: 'auto',
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  errorList: {
    flex: 1,
    overflow: 'auto',
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  fieldCard: {
    background: '#181825',
    borderRadius: 6,
    border: '1px solid #313244',
    overflow: 'hidden',
    flexShrink: 0,
  },
  fieldCardError: {
    borderColor: '#f38ba8',
    borderLeftWidth: 3,
  },
  fieldHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 8px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  expandIcon: {
    color: '#6c7086',
    fontSize: 8,
    width: 12,
  },
  fieldKey: {
    color: '#a6e3a1',
    fontWeight: 500,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  badges: {
    display: 'flex',
    gap: 4,
  },
  badge: {
    background: '#45475a',
    color: '#bac2de',
    padding: '1px 4px',
    borderRadius: 3,
    fontSize: 9,
  },
  dataPreview: {
    padding: '4px 8px 6px 26px',
    color: '#6c7086',
    fontSize: 11,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  fieldDetails: {
    borderTop: '1px solid #313244',
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  detailSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  detailLabel: {
    color: '#f9e2af',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  detailValue: {
    margin: 0,
    padding: 6,
    background: '#11111b',
    borderRadius: 4,
    overflow: 'auto',
    maxHeight: 120,
    fontSize: 11,
    color: '#cdd6f4',
  },
  errorCard: {
    background: 'rgba(243, 139, 168, 0.1)',
    border: '1px solid rgba(243, 139, 168, 0.3)',
    borderRadius: 6,
    padding: 8,
    flexShrink: 0,
  },
  errorPath: {
    color: '#f9e2af',
    fontWeight: 500,
    marginBottom: 2,
    fontSize: 11,
  },
  errorMessage: {
    color: '#f38ba8',
    fontSize: 11,
    lineHeight: 1.4,
  },
  errorCode: {
    display: 'inline-block',
    marginTop: 4,
    background: '#45475a',
    color: '#bac2de',
    padding: '1px 4px',
    borderRadius: 3,
    fontSize: 9,
  },
  noErrors: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 20,
    color: '#a6e3a1',
    fontSize: 11,
  },
  checkIcon: {
    fontSize: 14,
  },
  empty: {
    padding: 20,
    textAlign: 'center',
    color: '#6c7086',
    fontSize: 11,
  },
  errorCount: {
    color: '#f38ba8',
    fontWeight: 600,
    fontSize: 11,
  },
  errorPathItem: {
    background: '#45475a',
    color: '#f9e2af',
    padding: '2px 6px',
    borderRadius: 3,
    fontSize: 10,
  },
};
