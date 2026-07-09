/**
 * @file Navigate to and scroll to forms, sections, and fields in the designer.
 *
 * Search results update the design tab URL (`/design/:tabIndex?section=&field=`)
 * then poll the DOM until the target `data-designer-*` element mounts.
 */

import type {NavigateFunction} from 'react-router-dom';
import {
  designerFieldSelector,
  designerFormSelector,
  designerSectionSelector,
} from './designerElementIds';

type ViewMap = Record<string, {label: string; fields: string[]}>;
type ViewSetMap = Record<string, {label: string; views: string[]}>;

export type DesignerNavigationContext = {
  navigate: NavigateFunction;
  /** Route prefix for design tabs, e.g. `/design`. */
  designPath: string;
  visibleTypes: string[];
  untickedForms: string[];
  viewsets: ViewSetMap;
  views: ViewMap;
};

/** Visible forms first, then forms hidden via the form checklist. */
const combinedFormOrder = (
  visibleTypes: string[],
  untickedForms: string[]
): string[] => [...visibleTypes, ...untickedForms];

/** Tab index for a viewset in the design route, or null if the form is absent. */
export const getFormTabIndex = (
  viewSetId: string,
  visibleTypes: string[],
  untickedForms: string[]
): number | null => {
  const index = combinedFormOrder(visibleTypes, untickedForms).indexOf(
    viewSetId
  );
  return index >= 0 ? index : null;
};

/** Viewset id that owns `sectionId`, or null. */
export const findFormForSection = (
  sectionId: string,
  viewsets: ViewSetMap
): string | null => {
  for (const [formId, viewset] of Object.entries(viewsets)) {
    if (viewset.views.includes(sectionId)) return formId;
  }
  return null;
};

/** Section id that lists `fieldId`, or null. */
export const findSectionForField = (
  fieldId: string,
  views: ViewMap
): string | null => {
  for (const [sectionId, section] of Object.entries(views)) {
    if (section.fields.includes(fieldId)) return sectionId;
  }
  return null;
};

/** Zero-based section index within a viewset's `views` array. */
export const getSectionIndex = (
  sectionId: string,
  viewSetId: string,
  viewsets: ViewSetMap
): number | null => {
  const sectionIndex = viewsets[viewSetId]?.views.indexOf(sectionId) ?? -1;
  return sectionIndex >= 0 ? sectionIndex : null;
};

/** Builds `/design/:tabIndex?section=&field=` from navigation context. */
const buildDesignSearch = (
  ctx: DesignerNavigationContext,
  tabIndex: number,
  sectionIndex?: number,
  fieldId?: string
): string => {
  const params = new URLSearchParams();
  if (sectionIndex !== undefined) {
    params.set('section', String(sectionIndex));
  }
  if (fieldId) {
    params.set('field', fieldId);
  }
  const query = params.toString();
  return `${ctx.designPath}/${tabIndex}${query ? `?${query}` : ''}`;
};

/** Polls the DOM until the target element exists, then scrolls it into view. */
export const scrollToDesignerElement = (
  selector: string,
  options?: {
    maxAttempts?: number;
    intervalMs?: number;
    block?: ScrollLogicalPosition;
  }
): Promise<void> => {
  const {maxAttempts = 40, intervalMs = 50, block = 'center'} = options ?? {};

  return new Promise(resolve => {
    let attempts = 0;

    const tryScroll = () => {
      const element = document.querySelector(selector);
      if (element) {
        element.scrollIntoView({behavior: 'smooth', block});
        resolve();
        return;
      }

      // Route change may mount the target asynchronously — retry briefly.
      attempts += 1;
      if (attempts >= maxAttempts) {
        resolve();
        return;
      }

      window.setTimeout(tryScroll, intervalMs);
    };

    tryScroll();
  });
};

/** Opens the form tab, selects the first section, and scrolls to its top. */
export const scrollToForm = (
  viewSetId: string,
  ctx: DesignerNavigationContext
): void => {
  const tabIndex = getFormTabIndex(
    viewSetId,
    ctx.visibleTypes,
    ctx.untickedForms
  );
  if (tabIndex === null) return;

  const firstSectionId = ctx.viewsets[viewSetId]?.views[0];

  ctx.navigate(buildDesignSearch(ctx, tabIndex, 0));
  void scrollToDesignerElement(
    firstSectionId
      ? designerSectionSelector(firstSectionId)
      : designerFormSelector(viewSetId),
    {block: 'start'}
  );
};

/** Opens the containing form tab, activates the section, and scrolls to it. */
export const scrollToSection = (
  sectionId: string,
  ctx: DesignerNavigationContext
): void => {
  const viewSetId = findFormForSection(sectionId, ctx.viewsets);
  if (!viewSetId) return;

  const tabIndex = getFormTabIndex(
    viewSetId,
    ctx.visibleTypes,
    ctx.untickedForms
  );
  const sectionIndex = getSectionIndex(sectionId, viewSetId, ctx.viewsets);
  if (tabIndex === null || sectionIndex === null) return;

  ctx.navigate(buildDesignSearch(ctx, tabIndex, sectionIndex));
  void scrollToDesignerElement(designerSectionSelector(sectionId), {
    block: 'start',
  });
};

/** Opens form → section → field and scrolls to the field accordion. */
export const scrollToField = (
  fieldId: string,
  ctx: DesignerNavigationContext
): void => {
  const sectionId = findSectionForField(fieldId, ctx.views);
  if (!sectionId) return;

  const viewSetId = findFormForSection(sectionId, ctx.viewsets);
  if (!viewSetId) return;

  const tabIndex = getFormTabIndex(
    viewSetId,
    ctx.visibleTypes,
    ctx.untickedForms
  );
  const sectionIndex = getSectionIndex(sectionId, viewSetId, ctx.viewsets);
  if (tabIndex === null || sectionIndex === null) return;

  ctx.navigate(buildDesignSearch(ctx, tabIndex, sectionIndex, fieldId));
  void scrollToDesignerElement(designerFieldSelector(fieldId));
};
