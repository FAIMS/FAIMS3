import { PreviewFormManager } from '@faims3/forms';
import type { UiSpecModel } from '@faims3/data-model';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { useEffect, useRef } from 'react';
import { getAppTheme } from '../appTheme';
import { getMapConfig } from '../mapConfig';
import { PREVIEW_FORM_ID } from './singleFieldSpec';

const previewTheme = getAppTheme();

interface FieldPreviewHostProps {
  uiSpec: UiSpecModel;
  onReady: () => void;
}

/** Renders one field via PreviewFormManager for off-screen screenshot capture. */
export function FieldPreviewHost({ uiSpec, onReady }: FieldPreviewHostProps) {
  const readyRef = useRef(false);

  useEffect(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        onReady();
      });
    });
  }, [onReady]);

  return (
    <ThemeProvider theme={previewTheme}>
      <CssBaseline />
      <div
        data-field-preview-root
        style={{
          padding: 16,
          background: previewTheme.palette.background.paper,
          width: 560,
        }}
      >
        <PreviewFormManager
          formName={PREVIEW_FORM_ID}
          uiSpec={uiSpec}
          layout="inline"
          mapConfig={getMapConfig}
          initialFormData={{}}
        />
      </div>
    </ThemeProvider>
  );
}
