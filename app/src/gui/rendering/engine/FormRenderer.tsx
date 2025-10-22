import {
  FieldSummary,
  getNotebookFieldTypes,
  RecordMetadata,
  UISpecification,
} from '@faims3/data-model';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import React, {useMemo} from 'react';
import {DefaultRenderer, getRendererFromFieldConfig} from '../fields/register';
import {RenderContext, RenderFunctionConfiguration} from '../types';
import {EmptyResponsePlaceholder} from '../fields/wrappers';
import {FieldDebugger} from '../fields/specialised/util';
import {currentlyVisibleFields} from '../../../lib/form-utils';

/** Trace entry - helps to understand lineage when recursively rendering a form
 * renderer */
export type FormRendererTrace = {
  // ID of the record
  recordId: string;
  // The viewsetID called from
  viewsetId: string;
  // The view ID called from
  viewId: string;
  // Which field called this form?
  fieldId: string;
  // Call type - at the moment only related records call out
  callType: 'relatedRecord';
};

export interface FormRendererProps {
  viewsetId: string;
  // The UI Spec
  uiSpecification: UISpecification;
  // The hydrated data record
  hydratedRecord: RecordMetadata;
  config: {
    debugMode?: boolean;
  };
  // track history
  trace: FormRendererTrace[];
}
export const FormRenderer: React.FC<FormRendererProps> = props => {
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
      values: props.hydratedRecord.data ?? {},
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
          <FormRendererSection
            {...props}
            viewId={viewId}
            sectionFields={visibleSectionFields}
            key={viewId}
          ></FormRendererSection>
        );
      })}
    </Stack>
  );
};

export interface FormRendererSectionProps extends FormRendererProps {
  viewId: string;
  sectionFields: FieldSummary[];
}
const FormRendererSection: React.FC<FormRendererSectionProps> = props => {
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
                <FormRendererField {...props} fieldInfo={field} />
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

export interface FormRendererFieldProps extends FormRendererSectionProps {
  fieldInfo: FieldSummary;
}

const FormRendererField: React.FC<FormRendererFieldProps> = props => {
  // Get the data for this field
  const data = props.hydratedRecord.data?.[props.fieldInfo.name];

  // Get the renderer for the field
  const fieldRenderInfo = getRendererFromFieldConfig({
    uiSpecification: props.uiSpecification,
    fieldName: props.fieldInfo.name,
  });

  const FieldRenderer = fieldRenderInfo?.renderComponent;

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
  const rendererContext: RenderContext = {
    fieldId: props.fieldInfo.name,
    recordMetadata: props.hydratedRecord,
    viewId: props.viewId,
    viewsetId: props.viewsetId,
    uiSpecification: props.uiSpecification,
    trace: props.trace
  };

  // Debugging content to inject, if configured (config.debugMode)
  const debugContent = props.config.debugMode ? (
    // This is a component which provides a rich expandable menu of all the
    // field context- helpful for developing or debugging fields
    <FieldDebugger {...props} value={data} rendererContext={rendererContext} />
  ) : null;

  // Map config -> render context
  const renderConfig: RenderFunctionConfiguration = {
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
              config={renderConfig}
              rendererContext={rendererContext}
            />
          ) : (
            // Or use default fallback
            <DefaultRenderer
              value={data}
              config={renderConfig}
              rendererContext={rendererContext}
            />
          )}
        </Stack>
      </Box>
    );
  }
};
