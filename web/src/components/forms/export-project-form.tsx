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
import {ChevronRight} from 'lucide-react';

export type ExportType = 'csv' | 'geojson' | 'kml';
type ExportCategory = 'tabular' | 'geospatial';

/**
 * ExportProjectForm component renders a form for downloading a project's data.
 * It provides a button to download the project's data.
 */
const ExportProjectForm = () => {
  const {user} = useAuth();
  const {projectId} = Route.useParams();
  const {data} = useGetProject({user, projectId});
  const [exportCategory, setExportCategory] = useState<ExportCategory | null>(
    null
  );

  if (!data) {
    return null;
  }

  const isValidForSpatial = useMemo(() => {
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
      options: [{label: 'CSV', value: 'csv'}],
    },
    {
      name: 'form',
      label: 'Form',
      schema: z.string().min(1, 'Please select a form'),
      options:
        data && data['ui-specification']?.viewsets
          ? Object.keys(viewSets).map(name => ({
              label: viewSets[name].label || name,
              value: name,
            }))
          : [],
    },
  ];

  // Geospatial export form (GeoJSON and KML)
  const geospatialFields: Field[] = [
    {
      name: 'format',
      label: 'Format',
      schema: z.enum(['geojson', 'kml']),
      options: [
        {label: 'GeoJSON', value: 'geojson'},
        {label: 'KML (Google Earth)', value: 'kml'},
      ],
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

  const handleGeospatialSubmit = async ({format}: {format: ExportType}) => {
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
          <p className="text-sm text-muted-foreground">
            Export your project data in different formats. Choose the type of
            export that best suits your needs.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setExportCategory('tabular')}
            className="flex items-center justify-between p-4 rounded-lg border border-border bg-background shadow-sm hover:shadow-md hover:border-foreground/20 transition-all duration-200 text-left group"
          >
            <div className="flex-1">
              <p className="font-medium text-sm mb-1">Tabular (CSV)</p>
              <p className="text-sm text-muted-foreground">
                Export data from a specific form as a spreadsheet. Ideal for
                analysis in Excel or other tools.
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0 ml-4" />
          </button>

          <button
            onClick={() => isValidForSpatial && setExportCategory('geospatial')}
            disabled={!isValidForSpatial}
            className="flex items-center justify-between p-4 rounded-lg border border-border bg-background shadow-sm hover:shadow-md hover:border-foreground/20 transition-all duration-200 text-left group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm disabled:hover:border-border"
          >
            <div className="flex-1">
              <p className="font-medium text-sm mb-1">
                Geospatial (GeoJSON / KML)
              </p>
              <p className="text-sm text-muted-foreground">
                {isValidForSpatial
                  ? 'Export spatial data for use in mapping applications like QGIS, ArcGIS, or Google Earth.'
                  : 'Not available - this project does not contain any spatial data fields.'}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0 ml-4" />
          </button>
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
        <div className="text-sm text-muted-foreground mb-2">
          <p className="font-medium text-foreground mb-1">CSV Export</p>
          <p>
            Select which form you want to export. The download will include all
            records from that form in a spreadsheet format.
          </p>
        </div>
        <Form
          fields={tabularFields}
          onSubmit={handleTabularSubmit}
          submitButtonText="Download CSV"
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
      <div className="text-sm text-muted-foreground mb-2">
        <p className="font-medium text-foreground mb-1">Spatial Export</p>
        <p>
          Export all spatial data from your project in a GIS-compatible format.
          Choose GeoJSON for modern web mapping or KML for Google Earth and
          other applications.
        </p>
      </div>
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
