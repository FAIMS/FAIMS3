/**
 * @file DOM attribute names and CSS selectors for designer scroll targets.
 *
 * Forms, sections, and field accordions expose these attributes so global search
 * can scroll to the correct element after route navigation.
 */

/** DOM attributes used to locate designer elements for scroll/navigation. */
export const DESIGNER_FORM_ATTR = 'data-designer-form';
export const DESIGNER_SECTION_ATTR = 'data-designer-section';
export const DESIGNER_FIELD_ATTR = 'data-designer-field';

/** CSS selector for a form tab panel by viewset id. */
export const designerFormSelector = (viewSetId: string) =>
  `[${DESIGNER_FORM_ATTR}="${CSS.escape(viewSetId)}"]`;

/** CSS selector for a section block by section (view) id. */
export const designerSectionSelector = (sectionId: string) =>
  `[${DESIGNER_SECTION_ATTR}="${CSS.escape(sectionId)}"]`;

/** CSS selector for a field accordion by field storage key. */
export const designerFieldSelector = (fieldId: string) =>
  `[${DESIGNER_FIELD_ATTR}="${CSS.escape(fieldId)}"]`;
