/**
 * @file Shared submit-gating for plan configuration: loading, fetch failure,
 * incomplete config, or an unregistered plan type all block creation.
 */

import {config} from '@/constants';
import {getPlanConfigType, type PlanConfig} from './registry';

export type PlanSubmissionGate = {
  disabled: true;
  reason: string;
};

/**
 * Disable create-from-template while a plan config is required but not ready.
 * Returns undefined when submission may proceed.
 */
export const planSubmissionGate = ({
  planTemplate,
  planConfig,
  isLoading = false,
  isError = false,
}: {
  planTemplate?: {planType: string} | undefined;
  planConfig?: PlanConfig;
  isLoading?: boolean;
  isError?: boolean;
}): PlanSubmissionGate | undefined => {
  if (isLoading) {
    return {
      disabled: true,
      reason: `Loading plan configuration for this ${config.notebookName}.`,
    };
  }
  if (isError) {
    return {
      disabled: true,
      reason: `Could not load this template's plan configuration.`,
    };
  }
  if (!planTemplate || planConfig) return undefined;
  const planType = planTemplate.planType;
  return {
    disabled: true,
    reason: getPlanConfigType(planType)
      ? `Complete the plan configuration to create this ${config.notebookName}.`
      : `This template defines a ${planType} plan that cannot be configured here.`,
  };
};
