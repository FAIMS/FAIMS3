import {
  getFieldLabel,
  getFieldsForView,
  type UISpecification,
} from '@faims3/data-model';
import {
  Badge,
  Box,
  Button,
  Link,
  MobileStepper,
  Paper,
  Tab,
  Tabs,
  Theme,
  Typography,
  styled,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useElementWidth} from '../../hooks/useElementWidth';
import {FormManagerConfig} from '../formManagers';
import {FieldVisibilityMap} from '../formManagers/FormManager';
import {FaimsForm} from '../types';
import {FormSection} from './FormSection';
import {useStore} from '@tanstack/react-form';
import {getFieldId} from '../utils';

// ============================================================================
// Constants
// ============================================================================

/** Minimum width (in pixels) per step before switching to mobile stepper view */
const MIN_STEP_WIDTH_PX = 120;

/** Vertical spacing (in theme spacing units) around the error summary panel */
const ERROR_PANEL_VERTICAL_SPACING = 3;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Scrolls the viewport to bring a specific form field into view.
 *
 * Uses smooth scrolling animation and centers the field vertically in the
 * viewport for optimal visibility.
 *
 * @param fieldId - The field identifier used to construct the DOM element ID
 * @returns true if the element was found and scrolled to, false otherwise
 */
const scrollToField = (fieldId: string): boolean => {
  const elementId = getFieldId({fieldId});
  const element = document.getElementById(elementId);

  if (element) {
    element.scrollIntoView({behavior: 'smooth', block: 'center'});
    return true;
  }

  return false;
};

/**
 * Retrieves the human-readable label for a form section from the UI specification.
 *
 * Falls back to the section ID if no label is defined in the spec.
 *
 * @param uiSpec - The UI specification containing view definitions
 * @param sectionId - The identifier of the section/view
 * @returns The display label for the section
 */
const getSectionLabel = (
  uiSpec: UISpecification,
  sectionId: string
): string => {
  return uiSpec.views[sectionId]?.label ?? sectionId;
};

/**
 * Groups validation errors by their containing section.
 *
 * Iterates through all sections and identifies which fields with errors
 * belong to each section, creating a mapping of section IDs to their
 * error field names.
 *
 * @param errors - Map of field names to their error message arrays
 * @param sections - Ordered array of section IDs in the form
 * @param uiSpec - The UI specification defining field-to-section mappings
 * @returns Object mapping section IDs to arrays of field names with errors
 */
const groupErrorsBySection = (
  errors: Record<string, string[]>,
  sections: string[],
  uiSpec: UISpecification
): Record<string, string[]> => {
  const result: Record<string, string[]> = {};

  for (const sectionId of sections) {
    // Get all fields belonging to this section
    const sectionFields = getFieldsForView(uiSpec, sectionId);

    // Filter to only fields that have errors
    const sectionErrorFields = Object.keys(errors).filter(fieldName =>
      sectionFields.includes(fieldName)
    );

    // Only include sections that actually have errors
    if (sectionErrorFields.length > 0) {
      result[sectionId] = sectionErrorFields;
    }
  }

  return result;
};

/**
 * Determines the appropriate colour for a step indicator based on its state.
 *
 * Priority order: error (red) > active (primary) > completed (primary) > inactive (grey)
 *
 * @param isActive - Whether this step is currently selected
 * @param isCompleted - Whether this step has been visited and has no errors
 * @param hasError - Whether this step contains validation errors
 * @param theme - MUI theme object for accessing palette colours
 * @returns The appropriate colour value from the theme
 */
const getStepColor = (
  isActive: boolean,
  isCompleted: boolean,
  hasError: boolean,
  theme: Theme
): string => {
  if (hasError) return theme.palette.error.main;
  if (isActive) return theme.palette.primary.main;
  if (isCompleted) return theme.palette.success.main;
  return theme.palette.grey[400];
};

/**
 * Checks whether a section contains any validation errors.
 *
 * Cross-references the current error state with the fields defined
 * in the specified section to determine if any errors exist.
 *
 * @param sectionId - The section to check for errors
 * @param errors - Current map of field errors
 * @param uiSpec - UI specification for field lookups
 * @returns true if the section contains at least one field with errors
 */
const checkHasErrors = (
  sectionId: string,
  errors: Record<string, string[]>,
  uiSpec: UISpecification
): boolean => {
  const fields = getFieldsForView(uiSpec, sectionId);
  return Object.keys(errors).some(errorField => fields.includes(errorField));
};

/**
 * Checks whether a section has been visited by the user.
 *
 * A section is considered visited if any of its fields have been touched.
 * This is used to determine if a section should show the "completed" visual
 * state in the stepper.
 *
 * @param sectionId - The section to check for visited status
 * @param fieldMeta - The field metadata from form state containing touch info
 * @param uiSpec - UI specification for field lookups
 * @returns true if at least one field in the section has been touched
 */
const checkSectionVisited = (
  sectionId: string,
  fieldMeta: Record<string, {isTouched: boolean; errors: unknown[]}>,
  uiSpec: UISpecification
): boolean => {
  const fields = getFieldsForView(uiSpec, sectionId);
  return fields.some(fieldName => fieldMeta[fieldName]?.isTouched === true);
};

// ============================================================================
// Styled Components
// ============================================================================

/**
 * Custom styled Tab component for the desktop stepper view.
 *
 * Provides visual step indicators with connecting lines between steps.
 * The ::after pseudo-element creates the horizontal connector line.
 */
const StepperTab = styled(Tab)(() => ({
  textTransform: 'none',
  overflow: 'visible',
  minHeight: '70px',
  flex: 1,
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  justifyContent: 'flex-start',
  alignItems: 'center',
  // Offset to align the circle center with connector line
  paddingTop: '14px',

  // Connector line between steps
  '&::after': {
    content: '""',
    position: 'absolute',
    top: '27px',
    left: '50%',
    width: '100%',
    height: '2px',
    backgroundColor: '#383534',
    zIndex: -1,
  },

  // Hide connector on the last tab
  '&:last-child::after': {
    display: 'none',
  },
}));

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Props for the ErrorSummaryPanel component.
 */
interface ErrorSummaryPanelProps {
  /** Map of field names to their validation error messages */
  errors: Record<string, string[]>;
  /** UI specification for field label lookups */
  uiSpec: UISpecification;
  /** Currently active/visible section ID */
  activeSection: string;
  /** All section IDs in display order */
  sections: string[];
  /** Callback to navigate to a specific field, potentially in another section */
  onNavigateToField: (sectionId: string, fieldName: string) => void;
  /** Callback to navigate to a different section (without specific field) */
  onNavigateToSection: (sectionId: string) => void;
}

/**
 * Displays a summary of form validation errors with navigation links.
 *
 * For the current section, shows detailed error messages with clickable
 * links to scroll to each problematic field. For other sections, shows
 * simplified links to navigate to those sections without listing
 * individual field errors.
 *
 * The panel is styled as a warning box with error-coloured border and
 * light background. It only renders when there are actual errors to display.
 */
const ErrorSummaryPanel: React.FC<ErrorSummaryPanelProps> = ({
  errors,
  uiSpec,
  activeSection,
  sections,
  onNavigateToField,
  onNavigateToSection,
}) => {
  const theme = useTheme();

  // Group all errors by their containing section for organised display
  const errorsBySection = useMemo(
    () => groupErrorsBySection(errors, sections, uiSpec),
    [errors, sections, uiSpec]
  );

  // Separate current section errors from other sections
  const currentSectionErrors = errorsBySection[activeSection] ?? [];
  const otherSectionsWithErrors = Object.entries(errorsBySection).filter(
    ([sectionId]) => sectionId !== activeSection
  );

  // Don't render anything if there are no errors
  if (Object.keys(errors).length === 0) {
    return null;
  }

  /**
   * Handles click on a field link - prevents default anchor behaviour
   * and triggers navigation callback.
   */
  const handleFieldClick = (
    e: React.MouseEvent,
    sectionId: string,
    fieldName: string
  ) => {
    e.preventDefault();
    onNavigateToField(sectionId, fieldName);
  };

  /**
   * Handles click on a section link - navigates to the section
   * without targeting a specific field.
   */
  const handleSectionClick = (e: React.MouseEvent, sectionId: string) => {
    e.preventDefault();
    onNavigateToSection(sectionId);
  };

  /**
   * Renders a clickable link to a specific field with its error messages.
   * Used for displaying errors in the current section.
   */
  const renderFieldLink = (sectionId: string, fieldId: string) => {
    const label = getFieldLabel(uiSpec, fieldId);
    const fieldErrors = errors[fieldId] ?? [];

    // Deduplicate errors - onMount validation can cause duplicates
    const uniqueErrors = Array.from(new Set(fieldErrors));

    return (
      <Box key={fieldId} component="li" sx={{py: 0.5}}>
        <Link
          href={`#${getFieldId({fieldId})}`}
          onClick={e => handleFieldClick(e, sectionId, fieldId)}
          sx={{
            color: theme.palette.error.dark,
            textDecoration: 'underline',
            cursor: 'pointer',
            fontWeight: 500,
            '&:hover': {
              color: theme.palette.error.main,
            },
          }}
        >
          {label}
        </Link>

        {/* Display the first error message, with count of additional errors */}
        {uniqueErrors.length > 0 && (
          <Typography
            component="span"
            variant="body2"
            sx={{color: theme.palette.text.secondary, ml: 1}}
          >
            — {uniqueErrors[0]}
            {uniqueErrors.length > 1 && ` (+${uniqueErrors.length - 1} more)`}
          </Typography>
        )}
      </Box>
    );
  };

  /**
   * Renders a simplified link to a section with error count.
   * Used for displaying errors in other (non-active) sections.
   */
  const renderSectionLink = (sectionId: string, errorCount: number) => {
    const sectionLabel = getSectionLabel(uiSpec, sectionId);

    return (
      <Box key={sectionId} component="li" sx={{py: 0.5}}>
        <Link
          href="#"
          onClick={e => handleSectionClick(e, sectionId)}
          sx={{
            color: theme.palette.error.dark,
            textDecoration: 'underline',
            cursor: 'pointer',
            fontWeight: 500,
            '&:hover': {
              color: theme.palette.error.main,
            },
          }}
        >
          {sectionLabel}
        </Link>

        {/* Show count of errors in this section */}
        <Typography
          component="span"
          variant="body2"
          sx={{color: theme.palette.text.secondary, ml: 1}}
        >
          — {errorCount} {errorCount === 1 ? 'error' : 'errors'}
        </Typography>
      </Box>
    );
  };

  return (
    <Paper
      elevation={0}
      sx={{
        my: ERROR_PANEL_VERTICAL_SPACING,
        p: 2.5,
        border: '1px solid',
        borderColor: theme.palette.error.light,
        borderRadius: 1,
        bgcolor: 'rgba(211, 47, 47, 0.04)',
      }}
    >
      {/* Panel header */}
      <Typography
        variant="subtitle1"
        sx={{
          fontWeight: 600,
          color: theme.palette.error.dark,
          mb: 2,
        }}
      >
        Please fix the following errors
      </Typography>

      {/* Current section errors - shown with full detail */}
      {currentSectionErrors.length > 0 && (
        <Box sx={{mb: otherSectionsWithErrors.length > 0 ? 2.5 : 0}}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: theme.palette.text.primary,
              mb: 1,
            }}
          >
            In this section:
          </Typography>
          <Box component="ul" sx={{m: 0, pl: 2.5, listStyle: 'disc'}}>
            {currentSectionErrors.map(fieldName =>
              renderFieldLink(activeSection, fieldName)
            )}
          </Box>
        </Box>
      )}

      {/* Other section errors - shown as simplified section links */}
      {otherSectionsWithErrors.length > 0 && (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: theme.palette.text.primary,
              mb: 1,
            }}
          >
            In other sections:
          </Typography>
          <Box component="ul" sx={{m: 0, pl: 2.5, listStyle: 'disc'}}>
            {otherSectionsWithErrors.map(([sectionId, fieldNames]) =>
              renderSectionLink(sectionId, fieldNames.length)
            )}
          </Box>
        </Box>
      )}
    </Paper>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * Props for the TabbedSectionDisplay component.
 */
interface TabbedSectionDisplayProps {
  /** TanStack Form instance managing the form state */
  form: FaimsForm;
  /** Unique identifier for this form within the viewsets */
  formId: string;
  /** UI specification defining form structure, fields, and views */
  spec: UISpecification;
  /** Configuration for the form manager (renderers, validators, etc.) */
  config: FormManagerConfig;
  /**
   * Optional visibility map controlling which fields/sections are shown.
   * When undefined, all fields and sections are visible.
   */
  fieldVisibilityMap: FieldVisibilityMap | undefined;
}

/**
 * Displays form sections in a tabbed interface with responsive behaviour.
 *
 * This component provides two display modes:
 *
 * **Desktop View (default)**:
 * - Horizontal tabs with numbered step indicators
 * - Connecting lines between steps
 * - Visual feedback for errors (red indicators) and completed sections (primary colour)
 * - Hover effects on step circles
 *
 * **Mobile View** (activated when screen is small or tabs would be too cramped):
 * - Simplified stepper with Next/Back buttons
 * - Sticky header for navigation
 * - Step count indicator (e.g., "2 of 5")
 *
 * The component automatically switches between modes based on:
 * 1. Screen width (below 'sm' breakpoint)
 * 2. Available width per tab (below MIN_STEP_WIDTH_PX threshold)
 *
 * **Error Handling**:
 * - Displays error summary panels above and below the form content
 * - Current section errors show detailed field links with messages
 * - Other section errors show simplified navigation links
 * - Clicking error links scrolls to the field or navigates to the section
 *
 * **Field Validation Behaviour**:
 * - When leaving a section, all fields in that section are marked as touched
 * - This triggers validation display for any incomplete required fields
 * - Visited sections without errors display with the "completed" colour
 */
export const TabbedSectionDisplay: React.FC<TabbedSectionDisplayProps> = ({
  form,
  formId,
  spec,
  config,
  fieldVisibilityMap,
}) => {
  const theme = useTheme();

  // Extract form configuration from the UI spec
  const formSpec = spec.viewsets[formId];
  const sections = formSpec.views;

  // Subscribe to field metadata to track validation errors and touched state
  const fieldMeta = useStore(form.store, state => state.fieldMeta);

  // Build errors map from field metadata
  const errors: Record<string, string[]> = useMemo(() => {
    const errorMap: Record<string, string[]> = {};

    for (const [fieldName, meta] of Object.entries(fieldMeta)) {
      if (meta.errors.length > 0) {
        errorMap[fieldName] = meta.errors as string[];
      }
    }

    return errorMap;
  }, [fieldMeta]);

  // Filter sections to only those that are visible based on the visibility map
  const visibleSections = useMemo(() => {
    // If no visibility map, all sections are visible
    if (!fieldVisibilityMap) {
      return sections;
    }

    const visibleViews = Object.keys(fieldVisibilityMap);
    return sections.filter(sectionId => visibleViews.includes(sectionId));
  }, [sections, fieldVisibilityMap]);

  // Track the currently active section
  const [activeSection, setActiveSection] = useState<string>(sections[0]);
  const activeIndex = sections.indexOf(activeSection);

  // Measure container width for responsive behaviour
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useElementWidth(containerRef);

  // Determine if we should use mobile view based on screen size
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // Check if sections would be too cramped in desktop view
  const isTooDense =
    containerWidth > 0 && containerWidth / sections.length < MIN_STEP_WIDTH_PX;

  // Use mobile view if either condition is met
  const showMobileView = isSmallScreen || isTooDense;

  // Handle initial navigation context - scroll to field if specified
  useEffect(() => {
    if (config.mode === 'full') {
      if (config.navigationContext.scrollTarget !== undefined) {
        const targetFieldId = config.navigationContext.scrollTarget.fieldId;

        // Find which section contains this field
        const targetSection = sections.find(sectionId => {
          const sectionFields = getFieldsForView(spec, sectionId);
          return sectionFields.includes(targetFieldId);
        });

        if (targetSection) {
          // Navigate to the section if it's different from current
          if (targetSection !== activeSection) {
            setActiveSection(targetSection);
          }

          // Scroll to the field after a delay to allow rendering
          const timeout = setTimeout(() => {
            scrollToField(targetFieldId);
          }, 500);

          return () => {
            clearTimeout(timeout);
          };
        }
      }
    }
  }, []);

  /**
   * Marks all fields in the current section as touched and triggers validation.
   *
   * This is called when navigating away from a section to ensure users see
   * any validation errors for fields they may have skipped.
   */
  const handleSectionExit = useCallback(() => {
    const sectionFields = getFieldsForView(spec, activeSection);

    // Mark all fields in the section as touched
    for (const fieldName of sectionFields) {
      form.setFieldMeta(fieldName, meta => ({
        ...meta,
        isTouched: true,
      }));
    }

    // Trigger form-wide validation
    form.validate('change');
  }, [form, spec, activeSection]);

  /**
   * Handles navigation to a specific field, potentially in another section.
   *
   * If the field is in the current section, scrolls to it immediately.
   * If in another section, navigates to that section first.
   */
  const handleNavigateToField = useCallback(
    (sectionId: string, fieldName: string) => {
      if (sectionId === activeSection) {
        // Same section - just scroll to the field
        scrollToField(fieldName);
      } else {
        // Different section - navigate first, scroll will happen after render
        handleSectionExit();
        setActiveSection(sectionId);

        // Use requestAnimationFrame to scroll after the new section renders
        requestAnimationFrame(() => {
          // Small delay to ensure DOM has updated
          setTimeout(() => scrollToField(fieldName), 100);
        });
      }
    },
    [activeSection, handleSectionExit]
  );

  /**
   * Handles navigation to a different section without targeting a specific field.
   */
  const handleNavigateToSection = useCallback(
    (sectionId: string) => {
      if (sectionId !== activeSection) {
        handleSectionExit();
        setActiveSection(sectionId);
      }
    },
    [activeSection, handleSectionExit]
  );

  /**
   * Handles tab change in desktop view.
   */
  const handleTabChange = (_event: React.SyntheticEvent, newValue: string) => {
    handleSectionExit();
    setActiveSection(newValue);
  };

  /**
   * Handles next/back navigation in mobile view.
   */
  const handleStep = (direction: 'next' | 'back') => {
    handleSectionExit();

    const nextIndex = direction === 'next' ? activeIndex + 1 : activeIndex - 1;

    if (nextIndex >= 0 && nextIndex < sections.length) {
      setActiveSection(sections[nextIndex]);
    }
  };

  // Check if the active section should be displayed
  const shouldShowActiveSection = visibleSections.includes(activeSection);

  return (
    <Box ref={containerRef} sx={{width: '100%'}}>
      {/* Navigation: Desktop tabs or Mobile stepper */}
      {!showMobileView ? (
        // ================================================================
        // Desktop View - Horizontal tabs with step indicators
        // ================================================================
        <Box py={1}>
          <Box
            sx={{
              overflowX: 'visible',
              position: 'relative',
              zIndex: 1,
              padding: '15px 0',
            }}
          >
            <Tabs
              value={activeSection}
              onChange={handleTabChange}
              variant="fullWidth"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{
                overflowY: 'hidden',
                '& .MuiTabs-flexContainer': {
                  alignItems: 'flex-start',
                },
                // Hide the default underline indicator
                '& .MuiTabs-indicator': {display: 'none'},
              }}
            >
              {visibleSections.map((sectionId: string, index: number) => {
                const isActive = activeSection === sectionId;
                const hasError = checkHasErrors(sectionId, errors, spec);
                const isVisited = checkSectionVisited(
                  sectionId,
                  fieldMeta,
                  spec
                );

                // Section is completed if visited, not active, and has no errors
                const isCompleted = isVisited && !isActive && !hasError;

                const label = spec.views[sectionId]?.label ?? sectionId;

                return (
                  <StepperTab
                    key={sectionId}
                    value={sectionId}
                    disableRipple
                    label={
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          // Hover effect on the step circle
                          '&:hover': {
                            '& .step-circle': {
                              transform: 'scale(1.1)',
                              boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.2)',
                            },
                          },
                        }}
                      >
                        {/* Step number circle */}
                        <Box
                          className="step-circle"
                          sx={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            zIndex: 10,
                            transition: 'all 0.3s ease-in-out',
                            transform: isActive ? 'scale(1.1)' : 'scale(1)',
                            boxShadow: isActive
                              ? '0px 4px 12px rgba(0, 0, 0, 0.3)'
                              : '0px 2px 4px rgba(0, 0, 0, 0.15)',
                            color: '#fff',
                            bgcolor: getStepColor(
                              isActive,
                              isCompleted,
                              hasError,
                              theme
                            ),
                          }}
                        >
                          {index + 1}
                        </Box>

                        {/* Step label */}
                        <Typography
                          sx={{
                            mt: 1,
                            transform: isActive ? 'scale(1.1)' : 'scale(1)',
                            color: isActive
                              ? theme.palette.primary.dark
                              : theme.palette.grey[600],
                            fontWeight: 'bold',
                            transition: 'color 0.3s ease-in-out',
                            fontSize: '1rem',
                            whiteSpace: 'normal',
                            textAlign: 'center',
                          }}
                        >
                          {label}
                        </Typography>
                      </Box>
                    }
                  />
                );
              })}
            </Tabs>
          </Box>
        </Box>
      ) : (
        // ================================================================
        // Mobile View - Stepper with Next/Back buttons
        // ================================================================
        <Box>
          {/* Sticky navigation header */}
          <Box
            sx={{
              position: 'sticky',
              top: 0,
              background: theme.palette.background.paper,
              zIndex: 10,
              p: 1,
              borderBottom: `1px solid ${theme.palette.divider}`,
            }}
          >
            <MobileStepper
              variant="text"
              steps={sections.length}
              position="static"
              activeStep={activeIndex}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                bgcolor: 'transparent',
              }}
              nextButton={
                <Button
                  size="small"
                  onClick={() => handleStep('next')}
                  disabled={activeIndex === sections.length - 1}
                  sx={{fontWeight: 'bold'}}
                >
                  <Badge badgeContent={0} color="error">
                    Next
                  </Badge>
                </Button>
              }
              backButton={
                <Button
                  size="small"
                  onClick={() => handleStep('back')}
                  disabled={activeIndex === 0}
                  sx={{fontWeight: 'bold'}}
                >
                  Back
                </Button>
              }
            />
          </Box>

          {/* Section title for mobile view */}
          <Typography variant="h4" align="center" sx={{mt: 2, mb: 1}}>
            {spec.views[activeSection]?.label}
          </Typography>
        </Box>
      )}

      {/* Error summary panel - Top position */}
      <ErrorSummaryPanel
        errors={errors}
        uiSpec={spec}
        activeSection={activeSection}
        sections={sections}
        onNavigateToField={handleNavigateToField}
        onNavigateToSection={handleNavigateToSection}
      />

      {/* Active section content */}
      <Box role="tabpanel" sx={{mt: ERROR_PANEL_VERTICAL_SPACING}}>
        {shouldShowActiveSection ? (
          <FormSection
            key={activeSection}
            form={form}
            uiSpec={spec}
            section={activeSection}
            config={config}
            fieldVisibilityMap={fieldVisibilityMap}
          />
        ) : (
          <Typography variant="subtitle1" sx={{textAlign: 'center', py: 4}}>
            This section is not currently visible. Select another section.
          </Typography>
        )}
      </Box>

      {/* Error summary panel - Bottom position */}
      <ErrorSummaryPanel
        errors={errors}
        uiSpec={spec}
        activeSection={activeSection}
        sections={sections}
        onNavigateToField={handleNavigateToField}
        onNavigateToSection={handleNavigateToSection}
      />
    </Box>
  );
};
