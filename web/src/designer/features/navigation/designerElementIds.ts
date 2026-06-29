/** DOM attributes used to locate designer elements for scroll/navigation. */
export const DESIGNER_FORM_ATTR = 'data-designer-form';
export const DESIGNER_SECTION_ATTR = 'data-designer-section';
export const DESIGNER_FIELD_ATTR = 'data-designer-field';

export const designerFormSelector = (viewSetId: string) =>
  `[${DESIGNER_FORM_ATTR}="${CSS.escape(viewSetId)}"]`;

export const designerSectionSelector = (sectionId: string) =>
  `[${DESIGNER_SECTION_ATTR}="${CSS.escape(sectionId)}"]`;

export const designerFieldSelector = (fieldId: string) =>
  `[${DESIGNER_FIELD_ATTR}="${CSS.escape(fieldId)}"]`;
