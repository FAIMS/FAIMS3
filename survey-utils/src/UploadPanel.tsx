import React, { useCallback, useState } from 'react';

type Props = {
  onSpecLoaded: (content: string) => void;
  error: string | null;
  clearError: () => void;
};

export function UploadPanel({ onSpecLoaded, error, clearError }: Props) {
  const [drag, setDrag] = useState(false);

  const readFile = useCallback(
    (file: File) => {
      clearError();
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : '';
        onSpecLoaded(text);
      };
      reader.onerror = () => onSpecLoaded('');
      reader.readAsText(file, 'utf-8');
    },
    [onSpecLoaded, clearError]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const file = e.dataTransfer.files?.[0];
      if (file) readFile(file);
    },
    [readFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
  }, []);

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) readFile(file);
      e.target.value = '';
    },
    [readFile]
  );

  return (
    <section className="upload-panel">
      <div
        className={`drop-zone ${drag ? 'drag-over' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <input
          type="file"
          accept=".json,application/json"
          onChange={onFileInputChange}
          id="spec-file"
          className="file-input"
          aria-label="Choose JSON specification file"
        />
        <label htmlFor="spec-file" className="drop-label">
          Drag a JSON specification here or <span className="browse">browse</span> to upload
        </label>
        <p className="drop-hint">Notebook / survey UI specification (e.g. exported from FAIMS designer)</p>
      </div>
      {error ? <p className="upload-error" role="alert">{error}</p> : null}
    </section>
  );
}
