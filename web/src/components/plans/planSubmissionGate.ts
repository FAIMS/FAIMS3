/**
 * @file Shared submit-gating for plan configuration: loading, fetch failure,
 * an unregistered plan type, or a component-based plan without a config all
 * block creation. Field-based plan types are validated by the form itself.
 */

import type {PlanTemplate} from '@faims3/data-model';
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
  planTemplates = [],
  componentConfigs = {},
  isLoading = false,
  isError = false,
}: {
  planTemplates?: PlanTemplate[];
  /** Configs reported by component-based plan types, keyed by plan id. */
  componentConfigs?: Record<string, PlanConfig | undefined>;
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
  for (const template of planTemplates) {
    const definition = getPlanConfigType(template.planType);
    if (!definition) {
      return {
        disabled: true,
        reason: `The ${template.label} plan is of type ${template.planType}, which cannot be configured here.`,
      };
    }
    if ('fields' in definition) continue;
    if (!componentConfigs[template.planId]) {
      return {
        disabled: true,
        reason: `Complete the ${template.label} plan configuration to create this ${config.notebookName}.`,
      };
    }
  }
  return undefined;
};
