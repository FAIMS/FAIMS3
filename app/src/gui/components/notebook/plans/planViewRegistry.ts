/**
 * App-side registry mapping a notebook plan's `planType` to the React component
 * that renders that notebook's record view.
 *
 * It mirrors the data-model plan registry but lives in the app because it holds
 * React components, and data-model is React-free, so the component map cannot
 * live there. FAIMS3 ships this seam and the default view ({@link RecordsTable});
 * a downstream build (e.g. a map/grid view) registers its own component for a
 * given `planType` from its own bootstrap.
 */
import type {PlanTypeMap} from '@faims3/data-model';
import type {ComponentType} from 'react';
import {NotebookViewComponentProps} from '../types';

export type NotebookViewComponent = ComponentType<NotebookViewComponentProps>;

const notebookViewRegistry = new Map<
  keyof PlanTypeMap,
  NotebookViewComponent
>();

/** A component's `displayName`/`name`, for the dev-only collision warning. */
function componentName(component: NotebookViewComponent): string {
  const named = component as {displayName?: string; name?: string};
  return named.displayName ?? named.name ?? 'anonymous';
}

/**
 * Register the view component to render for a notebook plan's `planType`.
 * Re-registering a `planType` replaces the previous component (last wins), which
 * keeps hot-reload and re-bootstrapping well-behaved. A dev-only warning fires
 * when the replacement has a *different name*, which usually signals two views
 * fighting over one plan type. The comparison is by name, not identity, because
 * React Fast Refresh re-creates a component's function identity on every edit,
 * so an identity check would warn on nearly every hot reload.
 */
export function registerNotebookView(
  planType: keyof PlanTypeMap,
  component: NotebookViewComponent
): void {
  if (import.meta.env.DEV) {
    const existing = notebookViewRegistry.get(planType);
    if (existing && componentName(existing) !== componentName(component)) {
      console.warn(
        `registerNotebookView: replacing the view registered for plan type ` +
          `"${planType}" (${componentName(existing)} -> ${componentName(component)}).`
      );
    }
  }
  notebookViewRegistry.set(planType, component);
}

/**
 * Resolve the view component for a plan's `planType`,
 * or undefined if no view is registered.
 */
export function getNotebookView(
  planType?: keyof PlanTypeMap
): NotebookViewComponent | undefined {
  if (planType) {
    const registered = notebookViewRegistry.get(planType);
    if (registered) {
      return registered;
    }
  }
}
