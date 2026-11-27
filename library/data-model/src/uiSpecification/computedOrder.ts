// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: computedOrder.ts
 * Description:
 *   Works out the order to evaluate a form's computed fields in, so that one
 *   computed field can read another in the same form, and reports reference
 *   cycles, which have no valid order.
 */

import {extractExpressionReferences} from './expressions';

/** Component names of computed fields. */
const COMPUTED_COMPONENT_NAMES = new Set(['ComputedNumber', 'ComputedText']);

/** The evaluation order for a set of fields, and any reference cycles. */
export type ComputedOrder = {
  /**
   * Field IDs, each after every field it depends on. A field in a cycle, or
   * one that depends on a field in a cycle, has no place in it.
   */
  order: string[];
  /** Each cycle as a path ending where it starts, e.g. [A, B, A]. */
  cycles: string[][];
};

/**
 * Orders fields so each comes after the fields it depends on.
 *
 * A depth-first walk: before a field is placed, everything it depends on is
 * placed. Each field is unvisited, being visited, or done. Meeting a field
 * that is still being visited means the walk has come back onto its own
 * path, which is a cycle.
 *
 * @param dependencies Each field mapped to the fields it depends on
 */
export function sortByDependencies(
  dependencies: Map<string, string[]>
): ComputedOrder {
  const state = new Map<string, 'visiting' | 'done'>();
  // Fields with no valid position: in a cycle, or depending on one.
  const blocked = new Set<string>();
  const order: string[] = [];
  const cycles: string[][] = [];
  // The fields being visited, outermost first.
  const path: string[] = [];

  const visit = (field: string): void => {
    if (state.get(field) === 'done') {
      return;
    }
    if (state.get(field) === 'visiting') {
      const cycle = path.slice(path.indexOf(field));
      cycles.push([...cycle, field]);
      for (const member of cycle) {
        blocked.add(member);
      }
      return;
    }
    state.set(field, 'visiting');
    path.push(field);
    for (const dependency of dependencies.get(field) ?? []) {
      visit(dependency);
      if (blocked.has(dependency)) {
        blocked.add(field);
      }
    }
    path.pop();
    state.set(field, 'done');
    if (!blocked.has(field)) {
      order.push(field);
    }
  };

  // Map order, so the result is the same on every compile.
  for (const field of dependencies.keys()) {
    visit(field);
  }
  return {order, cycles};
}

/**
 * The evaluation order of one form's computed fields.
 *
 * A computed field depends on each computed field of the same form that its
 * expression references. References to other kinds of field, and to parent
 * or linked records, place no constraint on the order. Works from the
 * expression source, so it can run on a notebook still being edited.
 *
 * @param fields The notebook's field definitions
 * @param fieldIds The IDs of the form's fields, in form order
 */
export function computedFieldOrder({
  fields,
  fieldIds,
}: {
  fields: Record<
    string,
    | {
        'component-name'?: string;
        'component-parameters'?: object;
      }
    | undefined
  >;
  fieldIds: string[];
}): ComputedOrder {
  const expressions = new Map<string, string>();
  for (const fieldId of fieldIds) {
    const field = fields[fieldId];
    if (
      !field ||
      !COMPUTED_COMPONENT_NAMES.has(field['component-name'] ?? '')
    ) {
      continue;
    }
    const parameters = field['component-parameters'] as
      | {expression?: unknown}
      | undefined;
    const expression = parameters?.expression;
    expressions.set(fieldId, typeof expression === 'string' ? expression : '');
  }

  const dependencies = new Map<string, string[]>();
  for (const [fieldId, expression] of expressions) {
    dependencies.set(
      fieldId,
      extractExpressionReferences(expression).filter(ref =>
        expressions.has(ref)
      )
    );
  }
  return sortByDependencies(dependencies);
}

/**
 * Stores each computed field's position in its form's evaluation order on
 * the field, and warns about reference cycles.
 *
 * @param uiSpecification The notebook UI specification, updated in place
 */
export function attachComputedOrder(uiSpecification: {
  fields: Record<string, object | undefined>;
  views: Record<string, {fields?: string[]} | undefined>;
  viewsets: Record<string, {views?: string[]} | undefined>;
}): void {
  for (const [formId, form] of Object.entries(uiSpecification.viewsets ?? {})) {
    const fieldIds = (form?.views ?? []).flatMap(
      viewId => uiSpecification.views?.[viewId]?.fields ?? []
    );
    const {order, cycles} = computedFieldOrder({
      fields: uiSpecification.fields,
      fieldIds,
    });
    order.forEach((fieldId, index) => {
      Object.assign(uiSpecification.fields[fieldId] ?? {}, {
        expressionOrder: index,
      });
    });
    for (const cycle of cycles) {
      console.warn(
        `Computed fields in form "${formId}" reference each other in a cycle: ${cycle.join(' -> ')}`
      );
    }
  }
}
