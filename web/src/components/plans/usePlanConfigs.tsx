/**
 * @file Gathers configuration for every plan template a notebook template
 * carries. Field-based plan types contribute fields to the create form,
 * component-based ones render in its footer, and one gate holds submission
 * until every plan has a valid config.
 */

import {useCallback, useEffect, useMemo, useState, type ReactNode} from 'react';
import type {PlanTemplate} from '@faims3/data-model';
import type {Field} from '@/components/form';
import {PlanConfigSection} from './PlanConfigSection';
import {PlanHeading} from './PlanHeading';
import {planSubmissionGate} from './planSubmissionGate';
import {
  getPlanConfigType,
  type PlanConfig,
  type PlanConfigUiSpec,
} from './registry';

type Divider = {index: number; component: ReactNode};

export type PlanConfigs = Record<string, PlanConfig>;

export const usePlanConfigs = ({
  planTemplates,
  uiSpec,
  isLoading = false,
  isError = false,
}: {
  planTemplates: PlanTemplate[];
  uiSpec: PlanConfigUiSpec | undefined;
  isLoading?: boolean;
  isError?: boolean;
}) => {
  const [componentConfigs, setComponentConfigs] = useState<
    Record<string, PlanConfig | undefined>
  >({});

  // A different set of plans means the gathered configs no longer apply
  const planIdsKey = planTemplates.map(p => p.planId).join('\u0000');
  useEffect(() => {
    setComponentConfigs({});
  }, [planIdsKey]);

  const entries = useMemo(
    () =>
      planTemplates.map((template, index) => ({
        template,
        definition: getPlanConfigType(template.planType),
        // Prefixed by position: a plan id may contain characters
        // react-hook-form would read as a path
        prefix: `plan${index}_`,
      })),
    [planTemplates]
  );

  // Stable per-plan callbacks, so config forms' effects do not re-fire each render
  const onChangeFor = useMemo(
    () =>
      Object.fromEntries(
        entries.map(({template}) => [
          template.planId,
          (config: PlanConfig | undefined) =>
            setComponentConfigs(current => ({
              ...current,
              [template.planId]: config,
            })),
        ])
      ),
    [entries]
  );

  // Fields and headings from field-based plan types, indexed from zero
  const planFields = useMemo(() => {
    const fields: Field[] = [];
    const dividers: Divider[] = [];
    if (!uiSpec) return {fields, dividers};
    for (const {template, definition, prefix} of entries) {
      if (!definition || !('fields' in definition)) continue;
      dividers.push({
        index: fields.length,
        component: <PlanHeading template={template} />,
      });
      fields.push(...definition.fields({template, uiSpec, prefix}));
    }
    return {fields, dividers};
  }, [entries, uiSpec]);

  /** Append the plan fields after the form's own, shifting heading positions to match. */
  const appendTo = useCallback(
    (base: {fields: Field[]; dividers?: Divider[]}) => ({
      fields: [...base.fields, ...planFields.fields],
      dividers: [
        ...(base.dividers ?? []),
        ...planFields.dividers.map(d => ({
          ...d,
          index: d.index + base.fields.length,
        })),
      ],
    }),
    [planFields]
  );

  const componentEntries = entries.filter(
    e => !e.definition || !('fields' in e.definition)
  );
  const footer =
    uiSpec && componentEntries.length > 0 ? (
      <div className="flex flex-col gap-4">
        {componentEntries.map(({template}) => (
          <PlanConfigSection
            key={template.planId}
            template={template}
            uiSpec={uiSpec}
            onChange={onChangeFor[template.planId]}
          />
        ))}
      </div>
    ) : undefined;

  const gate = planSubmissionGate({
    planTemplates,
    componentConfigs,
    isLoading,
    isError,
  });

  /** Assemble planConfigs for the create request from the submitted form values. */
  const toPlanConfigs = useCallback(
    (values: Record<string, unknown>): PlanConfigs | undefined => {
      if (entries.length === 0) return undefined;
      const result: PlanConfigs = {};
      for (const {template, definition, prefix} of entries) {
        const config =
          definition && 'fields' in definition
            ? definition.toConfig(values, prefix)
            : componentConfigs[template.planId];
        if (config) result[template.planId] = config;
      }
      return result;
    },
    [entries, componentConfigs]
  );

  return useMemo(
    () => ({appendTo, footer, gate, toPlanConfigs}),
    [appendTo, footer, gate, toPlanConfigs]
  );
};
