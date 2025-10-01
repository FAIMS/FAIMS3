import {useAuth} from '@/context/auth-provider';
import {useGetProject} from '@/hooks/queries';
import {Route} from '@/routes/_protected/projects/$projectId';
import {
  decodeUiSpec,
  EncodedUISpecification,
  isValidForSpatialExport,
  ProjectUIViewsets,
} from '@faims3/data-model';
import {useMemo, useState} from 'react';
import {z} from 'zod';
import {Field, Form} from '../form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {Label} from '@/components/ui/label';

export type ExportType = 'csv' | 'geojson';
type ExportCategory = 'tabular' | 'geospatial';

/**
 * ExportProjectForm component renders a form for downloading a project's data.
 * It provides a button to download the project's data.
 */
const ExportProjectForm = () => {
  const {user} = useAuth();
  const {projectId} = Route.useParams();
  const {data} = useGetProject({user, projectId});
  const [exportCategory, setExportCategory] = useState<ExportCategory | null>(null);

  if (!data) {
    return null;
  }

  const isValidForGeoJSON = useMemo(() => {
    const uiSpecification = data['ui-specification'] as unknown;
    const decodedUiSpec = decodeUiSpec(
      uiSpecification as EncodedUISpecification
    );
    return isValidForSpatialExport({
      uiSpecification: decodedUiSpec,
    });
  }, [data]);

  const viewSets = data['ui-specification'].viewsets as ProjectUIViewsets;

  // Tabular export form (CSV)
  const tabularFields: Field[] = [
    {
      name: 'format',
      label: 'Format',
      schema: z.enum(['csv']),
      options: [
        {label: 'CSV', value: 'csv'},
      ],
    },
    {
      name: 'form',
      label: 'Form',
      schema: z.string().min(1, 'Please select a form'),
      options: data && data['ui-specification']?.viewsets
        ? Object.keys(viewSets).map(name => ({
            label: viewSets[name].label || name,
            value: name,
          }))
        : [],
    },
  ];

  // Geospatial export form (GeoJSON)
  const geospatialFields: Field[] = [
    {
      name: 'format',
      label: 'Format',
      schema: z.enum(['geojson']),
      options: [{label: 'GeoJSON', value: 'geojson'}],
    },
  ];

  const tabularDefaultValues = {
    format: 'csv' as const,
  };

  const geospatialDefaultValues = {
    format: 'geojson' as const,
  };

  const handleTabularSubmit = async ({
    form,
    format,
  }: {
    form: string;
    format: ExportType;
  }) => {
    if (user) {
      const downloadURL = `${import.meta.env.VITE_API_URL}/api/notebooks/${projectId}/records/export?format=${format}&viewID=${form}`;
      
      const response = await fetch(downloadURL, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
      });
      
      if (response.redirected) window.open(response.url, '_self');
    }
    return undefined;
  };

  const handleGeospatialSubmit = async ({
    format,
  }: {
    format: ExportType;
  }) => {
    if (user) {
      const downloadURL = `${import.meta.env.VITE_API_URL}/api/notebooks/${projectId}/records/export?format=${format}`;
      
      const response = await fetch(downloadURL, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
      });
      
      if (response.redirected) window.open(response.url, '_self');
    }
    return undefined;
  };

  // Initial selector
  if (!exportCategory) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="export-type">Export Type</Label>
          <Select
            value={exportCategory || ''}
            onValueChange={(value) => setExportCategory(value as ExportCategory)}
          >
            <SelectTrigger id="export-type">
              <SelectValue placeholder="Select export type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tabular">Tabular (CSV)</SelectItem>
              <SelectItem value="geospatial" disabled={!isValidForGeoJSON}>
                Geospatial (GeoJSON)
                {!isValidForGeoJSON && ' - No spatial data'}
              </SelectItem>
            </SelectContent>
          </Select>
          {!isValidForGeoJSON && (
            <p className="text-sm text-muted-foreground">
              Geospatial export is disabled because this project does not contain any spatial data fields.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Show appropriate form based on selection
  if (exportCategory === 'tabular') {
    return (
      <div className="flex flex-col gap-4">
        <button
          onClick={() => setExportCategory(null)}
          className="text-sm text-muted-foreground hover:text-foreground self-start"
        >
          ← Change export type
        </button>
        <Form
          fields={tabularFields}
          onSubmit={handleTabularSubmit}
          submitButtonText="Download"
          defaultValues={tabularDefaultValues}
        />
      </div>
    );
  }

  // Geospatial form
  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => setExportCategory(null)}
        className="text-sm text-muted-foreground hover:text-foreground self-start"
      >
        ← Change export type
      </button>
      <Form
        fields={geospatialFields}
        onSubmit={handleGeospatialSubmit}
        submitButtonText="Download"
        defaultValues={geospatialDefaultValues}
      />
    </div>
  );
};

export default ExportProjectForm;
