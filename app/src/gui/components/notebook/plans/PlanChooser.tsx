import {RegisteredPlan} from '@faims3/data-model';
import {RichTextContent} from '@faims3/forms';
import {Box, Button, Stack, Typography} from '@mui/material';

/**
 * The first screen of a notebook carrying more than one plan: one button per
 * plan, in the order the notebook declares them, headed by the plan's label and
 * carrying its description where it has one. Choosing one enters it for the
 * rest of the visit, so the plan view owns the whole screen and any tabs inside
 * it are the plan's own.
 *
 * `heading` is the notebook's own markdown for the screen, where its author
 * wrote one.
 */
export const PlanChooser = ({
  plans,
  heading,
  onSelect,
}: {
  plans: RegisteredPlan[];
  heading?: string;
  onSelect: (planId: string) => void;
}) => (
  // Centred by a full-width flex parent: a Stack resets its children's
  // margins, so `mx: 'auto'` on the panel itself does not survive.
  <Box
    sx={{p: 3, display: 'flex', justifyContent: 'center'}}
    data-testid="plan-chooser"
  >
    <Box sx={{width: '100%', maxWidth: 480}}>
      <Box sx={{mb: 2}} data-testid="plan-chooser-heading">
        {heading ? (
          <RichTextContent content={heading} />
        ) : (
          <Typography variant="h6" component="h2">
            Choose a plan
          </Typography>
        )}
      </Box>
      <Stack spacing={2}>
        {plans.map(plan => (
          <Button
            key={plan.planId}
            data-testid="plan-chooser-option"
            variant="outlined"
            size="large"
            fullWidth
            onClick={() => onSelect(plan.planId)}
            sx={{
              justifyContent: 'flex-start',
              py: 2,
              textAlign: 'left',
              textTransform: 'none',
            }}
          >
            {/* Spans, since a button may not carry the block elements
            Box and Typography render by default */}
            <Box component="span" sx={{display: 'block'}}>
              <Typography
                variant="subtitle1"
                component="span"
                sx={{display: 'block'}}
                data-testid="plan-chooser-option-label"
              >
                {plan.label}
              </Typography>
              {plan.description && (
                <Typography
                  variant="body2"
                  component="span"
                  sx={{display: 'block', color: 'text.secondary', mt: 0.5}}
                  data-testid="plan-chooser-option-description"
                >
                  {plan.description}
                </Typography>
              )}
            </Box>
          </Button>
        ))}
      </Stack>
    </Box>
  </Box>
);
