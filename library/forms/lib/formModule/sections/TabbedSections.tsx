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
  useTheme,
} from '@mui/material';
import {useState} from 'react';
import {FormManagerConfig} from '../formManagers';
import {FaimsForm} from '../types';
import {FormSection} from './FormSection';

// Placeholder for the color logic utility TODO: Implement actual validation
// logic based on formErrors and visitedSteps
const getStepColor = (
  isActive: boolean,
  isCompleted: boolean,
  hasError: boolean,
  theme: any
) => {
  if (hasError) return theme.palette.error.main;
  if (isActive) return theme.palette.primary.main; // Or primary.dark from old code
  if (isCompleted) return theme.palette.primary.main;
  return theme.palette.grey[400];
};

// Placeholder for error checking
const checkHasErrors = (sectionId: string) => false;

// Styled Tab to replicate the specific look of the old Stepper
const StepperTab = styled(Tab)(({theme}) => ({
  textTransform: 'none',
  overflow: 'visible',
  minHeight: '70px',
  flex: 1,
  position: 'relative',
  zIndex: 1,
  display: 'flex', // Ensure flex behavior
  justifyContent: 'flex-start', // Align content to the top
  alignItems: 'center', // Center content horizontally
  paddingTop: '14px', // Explicit top padding to align circle with the line

  '&::after': {
    content: '""',
    position: 'absolute',
    top: '27px', // Aligns with center of circle (14px pad + 13px half-circle)
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
 * TabbedSectionDisplay
 * Migrated from RecordStepper.tsx
 * Renders a responsive stepper: Horizontal Tabs for Desktop, Sticky MobileStepper for Mobile.
 */
export const TabbedSectionDisplay: React.FC<{
  form: FaimsForm;
  formId: string;
  spec: UISpecification;
  config: FormManagerConfig;
}> = props => {
  const theme = useTheme();
  const formSpec = props.spec.viewsets[props.formId];
  const sections = formSpec.views;

  // Initialize state with the first section
  const [activeSection, setActiveSection] = useState<string>(sections[0]);

  // Calculate numeric index for MobileStepper
  const activeIndex = sections.indexOf(activeSection);

  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setActiveSection(newValue);
  };

  // Helper for Mobile Navigation
  const handleStep = (direction: 'next' | 'back') => {
    const nextIndex = direction === 'next' ? activeIndex + 1 : activeIndex - 1;
    if (nextIndex >= 0 && nextIndex < sections.length) {
      setActiveSection(sections[nextIndex]);
    }
  };

  return (
    <Box sx={{width: '100%'}}>
      {/* --------------------------------------- */}
      {/* DESKTOP VIEW                            */}
      {/* --------------------------------------- */}
      <Box display={{xs: 'none', sm: 'block'}} py={1}>
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
              // --- CHANGED SECTION ---
              // We must target the internal flex container to align the tabs to the top
              '& .MuiTabs-flexContainer': {
                alignItems: 'flex-start',
              },
              // -----------------------
              '& .MuiTabs-scroller': {
                overflowX: 'auto !important',
                '&::-webkit-scrollbar': {height: 10},
                '&::-webkit-scrollbar-track': {backgroundColor: '#fff'},
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: '#fff',
                  borderRadius: 2,
                },
              },
              '& .MuiTabs-indicator': {display: 'none'},
            }}
          >
            {sections.map((sectionId: string, index: number) => {
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
                        // Hover effects from old code
                        '&:hover': {
                          '& .step-circle': {
                            transform: 'scale(1.1)',
                            boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.2)',
                          },
                          '& .step-bg': {
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            borderRadius: '10%',
                            transform: 'scale(1.1)',
                          },
                        },
                      }}
                    >
                      {/* Circle Icon */}
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
                          // Replicating old scaling logic
                          transform: isActive ? 'scale(1.1)' : 'scale(1)',
                          boxShadow: isActive
                            ? '0px 4px 12px rgba(0, 0, 0, 0.3)'
                            : '0px 2px 4px rgba(0, 0, 0, 0.15)',
                          // Color logic
                          color: '#fff',
                          bgcolor: getStepColor(
                            isActive,
                            false,
                            hasError,
                            theme
                          ),
                        }}
                      >
                        {/* Using exclamation for error, or number */}
                        {hasError ? '!' : index + 1}
                      </Box>

                      {/* Text Label */}
                      <Typography
                        sx={{
                          mt: 1,
                          // Replicating old text styles
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

      {/* ------------------------------------------------------------ */}
      {/* MOBILE VIEW */}
      {/* ------------------------------------------------------------ */}
      <Box display={{xs: 'block', sm: 'none'}}>
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
                {/* Badge logic from old stepper button */}
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
        {/* Label Display below stepper for Mobile */}
        <Typography
          variant="h4"
          align="center"
          style={{marginTop: theme.spacing(2)}}
        >
          {props.spec.views[activeSection]?.label}
        </Typography>
      </Box>

      {/* ------------------------------------------------------------ */}
      {/* ACTIVE SECTION CONTENT                                       */}
      {/* ------------------------------------------------------------ */}
      <Box role="tabpanel">
        <FormSection
          key={activeSection}
          form={props.form}
          uiSpec={props.spec}
          section={activeSection}
          config={props.config}
        />
      </Box>
    </Box>
  );
};
