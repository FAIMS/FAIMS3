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

// Minimum width per step before switching to mobile view
const MIN_STEP_WIDTH_PX = 120;

/**
 * Scrolls to a field element by its field name.
 * Returns true if the element was found and scrolled to.
 */
const scrollToField = (fieldId: string): boolean => {
  const elementId = getFieldId({fieldId: fieldId});
  const element = document.getElementById(elementId);

  if (element) {
    element.scrollIntoView({behavior: 'smooth', block: 'center'});
    return true;
  }

  return false;
};

/**
 * Gets the human-readable label for a section/view from the UI spec.
 */
const getSectionLabel = (
  uiSpec: UISpecification,
  sectionId: string
): string => {
  return uiSpec.views[sectionId]?.label ?? sectionId;
};

/**
 * Groups errors by their containing section.
 */
const groupErrorsBySection = (
  errors: Record<string, string[]>,
  sections: string[],
  uiSpec: UISpecification
): Record<string, string[]> => {
  const result: Record<string, string[]> = {};

  for (const sectionId of sections) {
    const sectionFields = getFieldsForView(uiSpec, sectionId);
    const sectionErrorFields = Object.keys(errors).filter(fieldName =>
      sectionFields.includes(fieldName)
    );

    if (sectionErrorFields.length > 0) {
      result[sectionId] = sectionErrorFields;
    }
  }

  return result;
};

/**
 * Displays a summary of form validation errors with clickable links
 * to navigate to and scroll to the problematic fields.
 */
const ErrorSummaryPanel: React.FC<{
  errors: Record<string, string[]>;
  uiSpec: UISpecification;
  activeSection: string;
  sections: string[];
  onNavigateToField: (sectionId: string, fieldName: string) => void;
}> = ({errors, uiSpec, activeSection, sections, onNavigateToField}) => {
  const theme = useTheme();

  const errorsBySection = useMemo(
    () => groupErrorsBySection(errors, sections, uiSpec),
    [errors, sections, uiSpec]
  );

  const currentSectionErrors = errorsBySection[activeSection] ?? [];
  const otherSectionErrors = Object.entries(errorsBySection).filter(
    ([sectionId]) => sectionId !== activeSection
  );

  // Don't render if no errors
  if (Object.keys(errors).length === 0) {
    return null;
  }

  const handleFieldClick = (
    e: React.MouseEvent,
    sectionId: string,
    fieldName: string
  ) => {
    e.preventDefault();
    onNavigateToField(sectionId, fieldName);
  };

  const renderFieldLink = ({
    sectionId,
    fieldId,
    showErrorMessages = false,
  }: {
    sectionId: string;
    fieldId: string;
    showErrorMessages?: boolean;
  }) => {
    const label = getFieldLabel(uiSpec, fieldId);
    const fieldErrors = errors[fieldId] ?? [];

    return (
      <Box key={fieldId} component="li" sx={{py: 0.5}}>
        <Link
          href={`#${getFieldId({fieldId: fieldId})}`}
          onClick={e => handleFieldClick(e, sectionId, fieldId)}
          sx={{
            color: theme.palette.error.dark,
            textDecoration: 'underline',
            cursor: 'pointer',
            '&:hover': {
              color: theme.palette.error.main,
            },
          }}
        >
          {label}
        </Link>
        {showErrorMessages && fieldErrors.length > 0 && (
          <Typography
            component="span"
            variant="body2"
            sx={{color: theme.palette.text.secondary, ml: 1}}
          >
            — {fieldErrors[0]}
            {fieldErrors.length > 1 && ` (+${fieldErrors.length - 1} more)`}
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <Paper
      elevation={0}
      sx={{
        mt: 3,
        p: 2,
        border: '1px solid',
        borderColor: theme.palette.error.light,
        borderRadius: 1,
        bgcolor: 'rgba(211, 47, 47, 0.04)',
      }}
    >
      <Typography
        variant="subtitle1"
        sx={{
          fontWeight: 600,
          color: theme.palette.error.dark,
          mb: 1.5,
        }}
      >
        Please fix the following errors
      </Typography>

      {/* Current section errors */}
      {currentSectionErrors.length > 0 && (
        <Box sx={{mb: otherSectionErrors.length > 0 ? 2 : 0}}>
          <Typography
            variant="body2"
            sx={{fontWeight: 500, color: theme.palette.text.primary, mb: 0.5}}
          >
            In this section:
          </Typography>
          <Box component="ul" sx={{m: 0, pl: 2.5, listStyle: 'disc'}}>
            {currentSectionErrors.map(fieldName =>
              renderFieldLink({
                sectionId: activeSection,
                fieldId: fieldName,
                showErrorMessages: true,
              })
            )}
          </Box>
        </Box>
      )}

      {/* Other section errors */}
      {otherSectionErrors.length > 0 && (
        <Box>
          <Typography
            variant="body2"
            sx={{fontWeight: 500, color: theme.palette.text.primary, mb: 0.5}}
          >
            In other sections:
          </Typography>
          {otherSectionErrors.map(([sectionId, fieldNames]) => (
            <Box key={sectionId} sx={{mb: 1}}>
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.text.secondary,
                  fontStyle: 'italic',
                  ml: 1,
                }}
              >
                {getSectionLabel(uiSpec, sectionId)}:
              </Typography>
              <Box component="ul" sx={{m: 0, pl: 2.5, listStyle: 'disc'}}>
                {fieldNames.map(fieldName =>
                  renderFieldLink({
                    sectionId,
                    fieldId: fieldName,
                    showErrorMessages: false,
                  })
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
};

/**
 * Returns the appropriate color for a step based on its state.
 */
const getStepColor = (
  isActive: boolean,
  isCompleted: boolean,
  hasError: boolean,
  theme: any
) => {
  if (hasError) return theme.palette.error.main;
  if (isActive) return theme.palette.primary.main;
  if (isCompleted) return theme.palette.primary.main;
  return theme.palette.grey[400];
};

/**
 * Checks if a section has validation errors.
 */
const checkHasErrors = ({
  sectionId,
  errors,
  uiSpec,
}: {
  sectionId: string;
  errors: Record<string, string[]>;
  uiSpec: UISpecification;
}) => {
  // Check if any of the errors are in this current section
  const fields = getFieldsForView(uiSpec, sectionId);
  return Object.keys(errors).some(err => fields.includes(err));
};

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
  // Align circle center with connector line
  paddingTop: '14px',

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

  '&:last-child::after': {
    display: 'none',
  },
}));

/**
 * Displays form sections in a tabbed interface with responsive desktop/mobile views.
 * Desktop view shows all sections as horizontal tabs with step indicators.
 * Mobile view shows a single section with next/back navigation.
 */
export const TabbedSectionDisplay: React.FC<{
  form: FaimsForm;
  formId: string;
  spec: UISpecification;
  config: FormManagerConfig;
  /** Visibility information - undefined means full visibility (disabling this
   * feature) */
  fieldVisibilityMap: FieldVisibilityMap | undefined;
}> = props => {
  const theme = useTheme();
  const formSpec = props.spec.viewsets[props.formId];
  const sections = formSpec.views;

  // Sub to errors
  const fieldMeta = useStore(props.form.store, state => state.fieldMeta);
  const errors: Record<string, string[]> = {};
  for (const [k, meta] of Object.entries(fieldMeta)) {
    if (meta.errors.length > 0) {
      errors[k] = meta.errors as string[];
    }
  }

  // Filtered visible sections (memoize)
  const visibleSections = useMemo(() => {
    const visibleViews = props.fieldVisibilityMap
      ? Object.keys(props.fieldVisibilityMap)
      : undefined;
    return sections.filter(s => {
      if (visibleViews === undefined) {
        return true;
      }
      return visibleViews.includes(s);
    });
  }, [props.fieldVisibilityMap]);

  const [activeSection, setActiveSection] = useState<string>(sections[0]);
  const activeIndex = sections.indexOf(activeSection);

  // Track a pending field to scroll to after section navigation
  const [pendingScrollTarget, setPendingScrollTarget] = useState<string | null>(
    null
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useElementWidth(containerRef);

  // Check if screen is below mobile breakpoint
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // Check if sections are too dense for available width
  const isTooDense =
    containerWidth > 0 && containerWidth / sections.length < MIN_STEP_WIDTH_PX;

  // Use mobile view if either condition is met
  const showMobileView = isSmallScreen || isTooDense;

  // Effect to handle scrolling after section change
  useEffect(() => {
    if (pendingScrollTarget) {
      // Use requestAnimationFrame to wait for DOM to update after section change
      const rafId = requestAnimationFrame(() => {
        // Add a small delay to ensure the section's fields have mounted
        // TODO: This timeout is a bit fragile - consider a more robust solution
        // like having FormSection signal when it's ready
        const timeoutId = setTimeout(() => {
          const success = scrollToField(pendingScrollTarget);
          if (!success) {
            console.warn(
              `Could not find field element for: ${pendingScrollTarget}`
            );
          }
          setPendingScrollTarget(null);
        }, 100);

        return () => clearTimeout(timeoutId);
      });

      return () => cancelAnimationFrame(rafId);
    }
  }, [activeSection, pendingScrollTarget]);

  /**
   * Handles navigation to a specific field, potentially in another section.
   */
  const handleNavigateToField = useCallback(
    (sectionId: string, fieldName: string) => {
      if (sectionId === activeSection) {
        // Same section - just scroll
        scrollToField(fieldName);
      } else {
        // Different section - navigate first, then scroll after render
        setActiveSection(sectionId);
        setPendingScrollTarget(fieldName);
      }
    },
    [activeSection]
  );

  /**
   * Handles tab change in desktop view.
   */
  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setActiveSection(newValue);
  };

  /**
   * Handles next/back navigation in mobile view.
   */
  const handleStep = (direction: 'next' | 'back') => {
    const nextIndex = direction === 'next' ? activeIndex + 1 : activeIndex - 1;
    if (nextIndex >= 0 && nextIndex < sections.length) {
      setActiveSection(sections[nextIndex]);
    }
  };

  return (
    <Box ref={containerRef} sx={{width: '100%'}}>
      {!showMobileView ? (
        // Desktop view with horizontal tabs
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
                '& .MuiTabs-indicator': {display: 'none'},
              }}
            >
              {visibleSections.map((sectionId: string, index: number) => {
                const isActive = activeSection === sectionId;
                const hasError = checkHasErrors({
                  errors,
                  sectionId,
                  uiSpec: props.spec,
                });
                const label = props.spec.views[sectionId]?.label ?? sectionId;

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
                          '&:hover': {
                            '& .step-circle': {
                              transform: 'scale(1.1)',
                              boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.2)',
                            },
                          },
                        }}
                      >
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
                              false,
                              hasError,
                              theme
                            ),
                          }}
                        >
                          {index + 1}
                        </Box>

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
        // Mobile view with stepper navigation
        <Box>
          <Box
            sx={{
              position: 'sticky',
              top: 0,
              background: '#fff',
              zIndex: 10,
              p: 1,
              borderBottom: '1px solid #ccc',
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
          <Typography
            variant="h4"
            align="center"
            style={{marginTop: theme.spacing(2)}}
          >
            {props.spec.views[activeSection]?.label}
          </Typography>
        </Box>
      )}

      {/* Active section content */}
      <Box role="tabpanel">
        {(visibleSections ? visibleSections.includes(activeSection) : true) ? (
          <FormSection
            key={activeSection}
            form={props.form}
            uiSpec={props.spec}
            section={activeSection}
            config={props.config}
            fieldVisibilityMap={props.fieldVisibilityMap}
          />
        ) : (
          <Typography variant="subtitle1">
            This section is not currently visible. Select another section.
          </Typography>
        )}
      </Box>

      {/* Error summary panel */}
      <ErrorSummaryPanel
        errors={errors}
        uiSpec={props.spec}
        activeSection={activeSection}
        sections={sections}
        onNavigateToField={handleNavigateToField}
      />
    </Box>
  );
};
