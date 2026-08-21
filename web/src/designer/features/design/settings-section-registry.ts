/**
 * @file Registry of extra sections for the designer's Settings panel, so a
 * module that owns a notebook setting can author it without this app naming it.
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

/** Keyed by id, so a repeat registration replaces rather than duplicates. */
const settingsSections = new Map<string, SettingsSection>();

/**
 * Add a section to the designer's Settings panel. The panel reads the registry
 * as it renders, so register at app start, before the designer mounts.
 *
 * @param id - Stable identifier; use the owning module's name.
 * @param section - Component rendered with the notebook's settings.
 * @returns Removes this registration again.
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
