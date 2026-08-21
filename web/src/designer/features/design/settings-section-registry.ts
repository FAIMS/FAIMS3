/**
 * @file Registry of extra sections for the designer's Settings panel.
 *
 * `NotebookSettingsSchema` passes through keys it does not declare, so a module
 * built on top of this app can own a notebook setting. This registry is how such
 * a module offers the designer UI for it: the Settings panel renders every
 * registered section after its own controls, and no key is named here.
 */

import type {ComponentType} from 'react';
import type {NotebookSettings} from '@faims3/data-model';

/** Props handed to a registered Settings-panel section. */
export type SettingsSectionProps = {
  /** The notebook's settings, including keys this app does not declare. */
  settings: NotebookSettings;
  /** Merge changed settings into the notebook design. */
  onChange: (update: Partial<NotebookSettings>) => void;
};

export type SettingsSection = ComponentType<SettingsSectionProps>;

/**
 * Registered sections keyed by id, which preserves insertion order and lets a
 * re-run of the same registration replace rather than duplicate a section.
 */
const settingsSections = new Map<string, SettingsSection>();

/**
 * Add a section to the designer's Settings panel. The panel reads the registry
 * as it renders, so register at app start, before the designer mounts.
 *
 * @param id - Stable identifier for the section; use the owning module's name.
 * @param section - Component rendered with the notebook's settings.
 * @returns Removes this registration again, for tests and hot reloads.
 */
export const registerSettingsSection = (
  id: string,
  section: SettingsSection
): (() => void) => {
  settingsSections.set(id, section);
  return () => {
    if (settingsSections.get(id) === section) settingsSections.delete(id);
  };
};

/** Registered sections with their ids, in registration order. */
export const getSettingsSections = (): [string, SettingsSection][] => [
  ...settingsSections,
];
