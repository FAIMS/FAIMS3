import {useAuth} from '@/context/auth-provider';
import {useGetProject} from '@/hooks/queries';
import {Route} from '@/routes/_protected/projects/$projectId';
import {
  decodeUiSpec,
  EncodedUISpecification,
  isValidForSpatialExport,
} from '@faims3/data-model';
import {useMemo, useState} from 'react';
import {z} from 'zod';
import {Field, Form} from '../form';
import {Label} from '@/components/ui/label';
import {Checkbox} from '@/components/ui/checkbox';

interface ExportOptions {
  includeTabular: boolean;
  includeAttachments: boolean;
  includeGeoJSON: boolean;
  includeKML: boolean;
  includeMetadata: boolean;
}

const DEFAULT_OPTIONS: ExportOptions = {
  includeTabular: true,
  includeAttachments: true,
  includeGeoJSON: true,
  includeKML: true,
  includeMetadata: true,
};

/**
 * ExportFullForm component renders a form for downloading a complete project export.
 * It allows users to configure which components to include in the export ZIP.
 */
const ExportFullForm = () => {
  const {user} = useAuth();
  const {projectId} = Route.useParams();
  const {data} = useGetProject({user, projectId});
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_OPTIONS);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValidForSpatial = useMemo(() => {
    if (!data) return false;
    const uiSpecification = data['ui-specification'] as unknown;
    const decodedUiSpec = decodeUiSpec(
      uiSpecification as EncodedUISpecification
    );
    return isValidForSpatialExport({
      uiSpecification: decodedUiSpec,
    });
  }, [data]);

  if (!data) {
    return null;
  }

  const handleOptionChange = (key: keyof ExportOptions, value: boolean) => {
    setOptions(prev => ({...prev, [key]: value}));
  };

  const handleSubmit = async () => {
    if (!user) return;

    setIsSubmitting(true);

    try {
      // Build query params from options
      const params = new URLSearchParams({
        format: 'full',
        includeTabular: options.includeTabular.toString(),
        includeAttachments: options.includeAttachments.toString(),
        includeGeoJSON: options.includeGeoJSON.toString(),
        includeKML: options.includeKML.toString(),
        includeMetadata: options.includeMetadata.toString(),
      });

      const downloadURL = `${import.meta.env.VITE_API_URL}/api/notebooks/${projectId}/records/export?${params.toString()}`;

      const response = await fetch(downloadURL, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (response.redirected) {
        window.open(response.url, '_self');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if at least one option is selected
  const hasSelection =
    options.includeTabular ||
    options.includeAttachments ||
    options.includeGeoJSON ||
    options.includeKML ||
    options.includeMetadata;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="font-medium text-sm">Include in export:</div>

        <div className="flex flex-col gap-3">
          {/* Tabular Data */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="includeTabular"
              checked={options.includeTabular}
              onCheckedChange={checked =>
                handleOptionChange('includeTabular', checked === true)
              }
            />
            <div className="flex flex-col gap-0.5">
              <Label
                htmlFor="includeTabular"
                className="text-sm font-medium cursor-pointer"
              >
                Tabular Data (CSV)
              </Label>
              <p className="text-xs text-muted-foreground">
                Spreadsheet files for each form containing all record data
              </p>
            </div>
          </div>

          {/* Attachments */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="includeAttachments"
              checked={options.includeAttachments}
              onCheckedChange={checked =>
                handleOptionChange('includeAttachments', checked === true)
              }
            />
            <div className="flex flex-col gap-0.5">
              <Label
                htmlFor="includeAttachments"
                className="text-sm font-medium cursor-pointer"
              >
                Photos & Attachments
              </Label>
              <p className="text-xs text-muted-foreground">
                All photos and files organized by form and field
              </p>
            </div>
          </div>

          {/* GeoJSON */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="includeGeoJSON"
              checked={options.includeGeoJSON}
              disabled={!isValidForSpatial}
              onCheckedChange={checked =>
                handleOptionChange('includeGeoJSON', checked === true)
              }
            />
            <div className="flex flex-col gap-0.5">
              <Label
                htmlFor="includeGeoJSON"
                className={`text-sm font-medium cursor-pointer ${!isValidForSpatial ? 'text-muted-foreground' : ''}`}
              >
                GeoJSON
              </Label>
              <p className="text-xs text-muted-foreground">
                {isValidForSpatial
                  ? 'Spatial data for web mapping applications'
                  : 'Not available — no spatial fields in this project'}
              </p>
            </div>
          </div>

          {/* KML */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="includeKML"
              checked={options.includeKML}
              disabled={!isValidForSpatial}
              onCheckedChange={checked =>
                handleOptionChange('includeKML', checked === true)
              }
            />
            <div className="flex flex-col gap-0.5">
              <Label
                htmlFor="includeKML"
                className={`text-sm font-medium cursor-pointer ${!isValidForSpatial ? 'text-muted-foreground' : ''}`}
              >
                KML (Google Earth)
              </Label>
              <p className="text-xs text-muted-foreground">
                {isValidForSpatial
                  ? 'Spatial data for Google Earth and desktop GIS'
                  : 'Not available — no spatial fields in this project'}
              </p>
            </div>
          </div>

          {/* Metadata */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="includeMetadata"
              checked={options.includeMetadata}
              onCheckedChange={checked =>
                handleOptionChange('includeMetadata', checked === true)
              }
            />
            <div className="flex flex-col gap-0.5">
              <Label
                htmlFor="includeMetadata"
                className="text-sm font-medium cursor-pointer"
              >
                Export Metadata
              </Label>
              <p className="text-xs text-muted-foreground">
                <a
                  href={'https://www.researchobject.org/ro-crate/'}
                  target="_blank"
                  referrerPolicy="no-referrer"
                  className="underline"
                >
                  ROCrate
                </a>{' '}
                JSON file with export statistics, record counts, and metadata
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick select buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            setOptions({
              includeTabular: true,
              includeAttachments: true,
              includeGeoJSON: isValidForSpatial,
              includeKML: isValidForSpatial,
              includeMetadata: true,
            })
          }
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Select all
        </button>
        <span className="text-xs text-muted-foreground">·</span>
        <button
          type="button"
          onClick={() =>
            setOptions({
              includeTabular: false,
              includeAttachments: false,
              includeGeoJSON: false,
              includeKML: false,
              includeMetadata: false,
            })
          }
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Clear all
        </button>
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!hasSelection || isSubmitting}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Preparing Export...' : 'Download Full Export'}
      </button>

      {!hasSelection && (
        <p className="text-sm text-destructive">
          Please select at least one component to include in the export.
        </p>
      )}
    </div>
  );
};

export default ExportFullForm;
