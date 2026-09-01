import {useAuth} from '@/context/auth-provider';
import {useGetProject} from '@/hooks/queries';
import {Route} from '@/routes/_protected/projects/$projectId';
import {GetExportNotebookResponse} from '@faims3/data-model';
import {ChevronRight} from 'lucide-react';
import {useState} from 'react';
import {z} from 'zod';
import {Field, Form} from '../form';
import {config} from '@/constants';
import {
  ExportTimeRangeFields,
  useExportTimeRange,
} from './export-time-range-fields';

type ExportScope = 'all' | 'single';

/**
 * ExportPhotosForm component renders a form for downloading a project's photos
 * as a ZIP. It allows the user to select which form to export photos from.
 */
const ExportPhotosForm = () => {
  const {user} = useAuth();
  const {projectId} = Route.useParams();
  const {data} = useGetProject({user, projectId});
  const [exportScope, setExportScope] = useState<ExportScope | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const timeRange = useExportTimeRange();

  if (!data) {
    return null;
  }

  const viewSets = data.uiSpecification.uiSpec.viewsets;

  const singleFormFields: Field[] = [
    {
      name: 'form',
      label: 'Form',
      description: 'Select the form to export photos from',
      schema: z.string().min(1, 'Please select a form'),
      options: data?.uiSpecification.uiSpec.viewsets
        ? Object.keys(viewSets).map(name => ({
            label: viewSets[name].label || name,
            value: name,
          }))
        : [],
    },
  ];

  /**
   * Handles the form submission for single form photo export
   */
  const handleSingleFormSubmit = async ({form}: {form: string}) => {
    if (user) {
      const params = new URLSearchParams({format: 'zip', viewID: form});
      timeRange.appendTo(params);
      const exportUrl = `${config.apiUrl}/api/notebooks/${projectId}/records/export?${params.toString()}`;
      const response = await fetch(exportUrl, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: {message?: string};
        } | null;
        return {
          message:
            body?.error?.message ??
            'Export failed. Please try again or contact support.',
        };
      }
      const downloadUrl = ((await response.json()) as GetExportNotebookResponse)
        .url;

      window.open(downloadUrl, '_self');
    }
    return undefined;
  };

  /**
   * Handles the form submission for all forms photo export
   */
  const handleAllFormsSubmit = async () => {
    if (user) {
      setSubmitError(null);
      const params = new URLSearchParams({format: 'zip'});
      timeRange.appendTo(params);
      const exportUrl = `${config.apiUrl}/api/notebooks/${projectId}/records/export?${params.toString()}`;
      const response = await fetch(exportUrl, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: {message?: string};
        } | null;
        setSubmitError(
          body?.error?.message ??
            'Export failed. Please try again or contact support.'
        );
        return;
      }

      const downloadUrl = ((await response.json()) as GetExportNotebookResponse)
        .url;

      window.open(downloadUrl, '_self');
    }
    return undefined;
  };

  // Initial selector
  if (!exportScope) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Export photos from your project. Choose whether to download photos
            from a specific form or from all forms.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setExportScope('all')}
            data-testid="web-export-photos-all"
            className="flex items-center justify-between p-4 rounded-lg border border-border bg-background shadow-sm hover:shadow-md hover:border-foreground/20 transition-all duration-200 text-left group"
          >
            <div className="flex-1">
              <p className="font-medium text-sm mb-1">All Forms</p>
              <p className="text-sm text-muted-foreground">
                Download photos from all forms in the project in a single ZIP
                file.
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0 ml-4" />
          </button>

          <button
            onClick={() => setExportScope('single')}
            className="flex items-center justify-between p-4 rounded-lg border border-border bg-background shadow-sm hover:shadow-md hover:border-foreground/20 transition-all duration-200 text-left group"
          >
            <div className="flex-1">
              <p className="font-medium text-sm mb-1">Single Form</p>
              <p className="text-sm text-muted-foreground">
                Download photos from a specific form only.
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0 ml-4" />
          </button>
        </div>
      </div>
    );
  }

  // Show all forms export
  if (exportScope === 'all') {
    return (
      <div className="flex flex-col gap-4">
        <button
          onClick={() => setExportScope(null)}
          className="text-sm text-muted-foreground hover:text-foreground self-start"
        >
          ← Change export scope
        </button>
        <div className="text-sm text-muted-foreground mb-2">
          <p className="font-medium text-foreground mb-1">Export All Photos</p>
          <p>
            Download all photos from every form in your project. The photos will
            be organized in a ZIP file.
          </p>
        </div>
        <ExportTimeRangeFields {...timeRange} />
        <button
          onClick={handleAllFormsSubmit}
          disabled={Boolean(timeRange.error)}
          data-testid="web-export-photos-download"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Download All Photos
        </button>
        {submitError && (
          <p className="min-w-0 max-w-full break-words text-sm text-destructive">
            {submitError}
          </p>
        )}
      </div>
    );
  }

  // Show single form export
  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => setExportScope(null)}
        className="text-sm text-muted-foreground hover:text-foreground self-start"
      >
        ← Change export scope
      </button>
      <div className="text-sm text-muted-foreground mb-2">
        <p className="font-medium text-foreground mb-1">
          Export Photos from Single Form
        </p>
        <p>
          Select which form you want to export photos from. The download will
          include all photos from that form in a ZIP file.
        </p>
      </div>
      <Form
        fields={singleFormFields}
        onSubmit={handleSingleFormSubmit}
        submitButtonText="Download Photos"
        submitButtonTestId="web-export-photos-download"
        footer={<ExportTimeRangeFields {...timeRange} />}
        disableSubmission={
          timeRange.error
            ? {disabled: true, reason: timeRange.error}
            : undefined
        }
      />
    </div>
  );
};

export default ExportPhotosForm;
