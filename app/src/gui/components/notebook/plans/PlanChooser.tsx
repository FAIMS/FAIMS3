import {RegisteredPlan, getPlanLabel} from '@faims3/data-model';
import {Box, Button, Stack, Typography} from '@mui/material';

/**
 * The first screen of a notebook carrying more than one plan: one button per
 * workflow, in the order the notebook declares them. Choosing one enters it for
 * the rest of the visit, so the plan view owns the whole screen and any tabs
 * inside it are the plan's own.
 */
export const PlanChooser = ({
  plans,
  onSelect,
}: {
  plans: {plan: RegisteredPlan}[];
  onSelect: (planId: string) => void;
}) => (
  <Box sx={{p: 3, maxWidth: 480, mx: 'auto'}} data-testid="plan-chooser">
    <Typography variant="h6" component="h2" sx={{mb: 2}}>
      Choose a workflow
    </Typography>
    <Stack spacing={2}>
      {plans.map(({plan}) => (
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
);
