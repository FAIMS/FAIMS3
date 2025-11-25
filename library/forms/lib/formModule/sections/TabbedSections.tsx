import type {UISpecification} from '@faims3/data-model';
import {
  Badge,
  Box,
  Button,
  MobileStepper,
  Tab,
  Tabs,
  Typography,
  styled,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {useMemo, useRef, useState} from 'react';
import {useElementWidth} from '../../hooks/useElementWidth';
import {FormManagerConfig} from '../formManagers';
import {FaimsForm} from '../types';
import {FormSection} from './FormSection';
import {FieldVisibilityMap} from '../formManagers/FormManager';

// Minimum width per step before switching to mobile view
const MIN_STEP_WIDTH_PX = 120;

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
 * TODO: Implement actual error checking logic.
 */
const checkHasErrors = (sectionId: string) => false;

const StepperTab = styled(Tab)(({theme}) => ({
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

  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useElementWidth(containerRef);

  // Check if screen is below mobile breakpoint
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // Check if sections are too dense for available width
  const isTooDense =
    containerWidth > 0 && containerWidth / sections.length < MIN_STEP_WIDTH_PX;

  // Use mobile view if either condition is met
  const showMobileView = isSmallScreen || isTooDense;

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
                const hasError = checkHasErrors(sectionId);
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
                          {hasError ? '!' : index + 1}
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
                  <Badge
                    badgeContent={
                      checkHasErrors(sections[activeIndex + 1]) ? '!' : 0
                    }
                    color="error"
                  >
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
    </Box>
  );
};
