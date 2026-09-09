import type z from 'zod';
import {PlanSchema, type PlanRegistry} from './types';
import {getPlanTypeDefinition} from './registry';

/**
 * Open, compile-time map from a plan's `planType` to its registered definition.
 * Each plan module augments this with a one-line `declare module` (see the
 * bottom of countedPlan.ts / listOfRecordsPlan.ts).
 *
 * It holds NO runtime data. It is purely the *typed view* of the string-keyed
 * runtime {@link PlanRegistry}, and it is what lets consumers get (a) a typed
 * lookup and (b) a narrowable stored plan. Types are erased at runtime, so this
 * cannot populate the registry and the registry cannot produce these types; each
 * plan therefore pairs its `declare module` here with its ordinary registration.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PlanTypeMap {}

/**
 * Drop a `{ [key: string]: unknown }` catch-all index signature, keeping only
 * explicitly-named keys. The plan schemas are `.passthrough()` (kept at runtime
 * for forward-compat), which otherwise leaks that catch-all into the inferred
 * type and makes a wrong-plan field read as `unknown` instead of erroring.
 */
type RemoveIndexSignature<T> = {
  [K in keyof T as string extends K
    ? never
    : number extends K
      ? never
      : K]: T[K];
};

/**
 * The plan-instance type for one registered plan type (its `planSchema`'s
 * output), with the passthrough catch-all stripped so only the plan's own fields
 * are visible. Runtime parsing still keeps unknown fields on the object.
 */
export type PlanOf<K extends keyof PlanTypeMap> = PlanTypeMap[K] extends {
  planSchema: infer S;
}
  ? S extends z.ZodTypeAny
    ? RemoveIndexSignature<z.infer<S>>
    : never
  : never;

/**
 * Discriminated union of every registered plan instance. Type a stored plan as
 * this so `plan.planType === 'Counted'` narrows to that plan's own fields.
 */
export type RegisteredPlan = {
  [K in keyof PlanTypeMap]: PlanOf<K>;
}[keyof PlanTypeMap];

/**
 * Typed lookup: `getPlanDefinition('Counted')` returns the Counted definition
 * rather than the erased `AnyPlanTypeDefinition`. Thin typed wrapper over the
 * runtime {@link getPlanTypeDefinition} (same behaviour, precise return type).
 */
export const getPlanDefinition = <K extends keyof PlanTypeMap>(
  planType: K,
  registry?: PlanRegistry
): PlanTypeMap[K] | undefined =>
  getPlanTypeDefinition(planType, registry) as PlanTypeMap[K] | undefined;

/**
 * {@link PlanSchema} retyped so `z.infer` yields {@link RegisteredPlan}, without
 * changing its runtime behaviour (still the passthrough base parse). Use it for a
 * notebook's stored `plan` field so the parsed value narrows by `planType`; the
 * plan's own fields are still runtime-validated by `safeValidatePlan`.
 */
export const RegisteredPlanSchema =
  PlanSchema as unknown as z.ZodType<RegisteredPlan>;
