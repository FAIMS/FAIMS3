import {
  currentlyVisibleFields,
  FieldSummary,
  getNotebookFieldTypes,
} from '@faims3/data-model';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Stack,
  Typography,
} from '@mui/material';
import React, {useMemo} from 'react';
import {formDataExtractor} from '../utils';
import {
  DefaultRenderer,
  getRendererFromFieldConfig,
} from './fields/fieldRegistry';
import {EmptyResponsePlaceholder} from './fields/view';
import {FieldDebugger} from './fields/view/specialised/util';
import {
  DataViewFieldRenderConfiguration,
  DataViewFieldRenderContext,
  DataViewProps,
} from './types';

export const DataView: React.FC<DataViewProps> = props => {
  // List of field info for this viewset
  const fieldInfo: FieldSummary[] = useMemo(() => {
    return getNotebookFieldTypes({
      uiSpecification: props.uiSpecification,
      viewID: props.viewsetId,
    });
  }, [props.uiSpecification]);

  // create map of viewId -> fields
  const fieldsByView: Map<string, FieldSummary[]> = useMemo(() => {
    const viewMap: Map<string, FieldSummary[]> = new Map();
    for (const field of fieldInfo) {
      const viewId = field.viewId;
      const currentList = viewMap.get(viewId) ?? [];
      currentList.push(field);
      viewMap.set(viewId, currentList);
    }
    return viewMap;
  }, [props.uiSpecification]);

  const visibleFields = useMemo(() => {
    return currentlyVisibleFields({
      uiSpec: props.uiSpecification,
      values: formDataExtractor({fullData: props.formData}),
      viewsetId: props.viewsetId,
    });
  }, [props.uiSpecification, props.hydratedRecord]);

  return (
    <Stack spacing={2} sx={{padding: 2}}>
      {Array.from(fieldsByView.entries()).map(([viewId, sectionFields]) => {
        // Filter for only visible fields
        const visibleSectionFields = sectionFields.filter(f =>
          visibleFields.includes(f.name)
        );

        // Check if any fields in this section are actually visible (not hidden)
        const hasVisibleContent = visibleSectionFields.some(field => {
          // Check if field is hidden via component-parameters
          const isHidden =
            props.uiSpecification.fields[field.name]?.['component-parameters']
              ?.hidden === true;
          return !isHidden;
        });

        // Don't render the section if there's no visible content
        if (!hasVisibleContent) {
          return null;
        }

        return (
          <DataViewSection
            {...props}
            viewId={viewId}
            sectionFields={visibleSectionFields}
            key={viewId}
          ></DataViewSection>
        );
      })}
    </Stack>
  );
};

export interface DataViewSectionProps extends DataViewProps {
  viewId: string;
  sectionFields: FieldSummary[];
}
const DataViewSection: React.FC<DataViewSectionProps> = props => {
  // Get the section label
  const sectionLabel = props.uiSpecification.views[props.viewId]?.label;

  return (
    <Accordion
      defaultExpanded
      disableGutters
      elevation={1}
      sx={{
        backgroundColor: 'grey.50',
        borderRadius: '4px !important',
        '&:before': {
          display: 'none',
        },
        '&:not(:last-child)': {
          marginBottom: 2,
        },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          padding: '0 16px',
          minHeight: 56,
          '&.Mui-expanded': {
            minHeight: 56,
          },
          '& .MuiAccordionSummary-content': {
            margin: '12px 0',
            '&.Mui-expanded': {
              margin: '12px 0',
            },
          },
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            color: 'text.primary',
          }}
        >
          {sectionLabel ?? props.viewId}
        </Typography>
      </AccordionSummary>
      <AccordionDetails
        sx={{
          padding: 2,
          paddingTop: 0,
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, 1fr)',
            },
            gap: 1.5,
            columnGap: 3,
          }}
        >
          {props.sectionFields.map(field => {
            // Get the renderer for this field to check its attributes
            const renderer = getRendererFromFieldConfig({
              uiSpecification: props.uiSpecification,
              fieldName: field.name,
            });

            // Check if this field should span full width based on renderer attributes
            const singleColumn = renderer?.attributes?.singleColumn === true;

            return (
              <Box
                key={field.name}
                sx={{
                  gridColumn: singleColumn ? '1 / -1' : 'auto',
                }}
              >
                <DataViewField {...props} fieldInfo={field} />
              </Box>
            );
          })}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
};

/**
 * Checks if a value (which could be anything) appears to be empty
 * @param val The value to check
 * @returns True iff response is empty
 */
function isResponseEmpty(val: any): boolean {
  return (
    // null case
    val === null ||
    // undefined case
    val === undefined ||
    // empty string response - sometimes happens with text fields or geometries
    (typeof val === 'string' &&
      (val.trim() === '' ||
        // It's worth noting FAIMS sometimes includes the literal string '""' to
        // represent empty values
        val === '""'))
  );
}

export interface DataViewFieldProps extends DataViewSectionProps {
  fieldInfo: FieldSummary;
}

const DataViewField: React.FC<DataViewFieldProps> = props => {
  // Get the data for this field
  const {data, annotation, attachments} = props.formData[
    props.fieldInfo.name
  ] ?? {
    data: undefined,
    annotation: undefined,
    attachments: undefined,
  };

  // Get the renderer for the field
  const fieldRenderInfo = getRendererFromFieldConfig({
    uiSpecification: props.uiSpecification,
    fieldName: props.fieldInfo.name,
  });

  const FieldRenderer = fieldRenderInfo?.component;

  // Grab the UI label for this field
  // This is the configured UI label for this field, i.e. the title
  const uiLabel =
    props.uiSpecification.fields[props.fieldInfo.name]?.['component-parameters']
      ?.label;

  // hidden when component-parameters.hidden: true
  const isHidden =
    props.uiSpecification.fields[props.fieldInfo.name]?.['component-parameters']
      ?.hidden === true;

  const isEmpty = isResponseEmpty(data);

  // Map state -> render context
  const rendererContext: DataViewFieldRenderContext = {
    fieldId: props.fieldInfo.name,
    record: props.hydratedRecord,
    viewId: props.viewId,
    viewsetId: props.viewsetId,
    uiSpecification: props.uiSpecification,
    trace: props.trace,
    tools: props.tools,
    formData: props.formData,
    hrid: props.hrid,
  };

  // Debugging content to inject, if configured (config.debugMode)
  const debugContent = props.config.debugMode ? (
    // This is a component which provides a rich expandable menu of all the
    // field context- helpful for developing or debugging fields
    <FieldDebugger
      {...props}
      value={data}
      attachments={attachments}
      annotation={annotation}
      renderContext={rendererContext}
    />
  ) : null;

  // Map config -> render context
  const renderConfig: DataViewFieldRenderConfiguration = {
    debugMode: props.config.debugMode,
  };

  if (isHidden) {
    return null;
  } else {
    // Return the custom renderer for this field
    return (
      <Box>
        <Stack direction="column" spacing={0.5}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              color: 'text.secondary',
              fontSize: '0.875rem',
            }}
          >
            {uiLabel}
          </Typography>
          {debugContent}
          {
            // Note that we check here whether to bypass null checks
          }
          {!fieldRenderInfo?.attributes?.bypassNullChecks && isEmpty ? (
            <EmptyResponsePlaceholder />
          ) : FieldRenderer ? (
            // Render the field with the appropriate renderer
            <FieldRenderer
              value={data}
              attachments={attachments}
              annotation={annotation}
              config={renderConfig}
              renderContext={rendererContext}
            />
          ) : (
            // Or use default fallback
            <DefaultRenderer
              value={data}
              attachments={attachments}
              annotation={annotation}
              config={renderConfig}
              renderContext={rendererContext}
            />
          )}
        </Stack>
      </Box>
    );
  }
};
