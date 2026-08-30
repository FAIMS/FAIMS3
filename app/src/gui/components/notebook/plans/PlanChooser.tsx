import {RegisteredPlan, getPlanLabel} from '@faims3/data-model';
import {Box, Button, Stack, Typography} from '@mui/material';

/**
 * The first screen of a notebook carrying more than one plan: one button per
 * plan, in the order the notebook declares them. Choosing one enters it for the
 * rest of the visit, so the plan view owns the whole screen and any tabs inside
 * it are the plan's own.
 */
export const PlanChooser = ({
  plans,
  onSelect,
}: {
  plans: RegisteredPlan[];
  onSelect: (planId: string) => void;
}) => (
  // Centred by a full-width flex parent: a Stack resets its children's
  // margins, so `mx: 'auto'` on the panel itself does not survive.
  <Box
    sx={{p: 3, display: 'flex', justifyContent: 'center'}}
    data-testid="plan-chooser"
  >
    <Box sx={{width: '100%', maxWidth: 480}}>
      <Typography variant="h6" component="h2" sx={{mb: 2}}>
        Choose a plan
      </Typography>
      <Stack spacing={2}>
        {plans.map(plan => (
          <Button
            key={plan.planId}
            data-testid="plan-chooser-option"
            variant="outlined"
            size="large"
            fullWidth
            onClick={() => onSelect(plan.planId)}
            sx={{justifyContent: 'flex-start', py: 2, textTransform: 'none'}}
          >
            {getPlanLabel(plan)}
          </Button>
        ))}
      </Stack>
    </Box>
  </Box>
);
