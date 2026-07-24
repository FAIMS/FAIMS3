import {textFieldSpec} from './fields/TextFields';
import {FieldInfo} from './types';

/**
 * Lookup surface for the field registry.
 *
 * Kept free of the full field-spec list so modules like DataView can resolve
 * renderers without forming a static cycle:
 * RelatedRecord field → RelatedRecord view → DataView → registry → RelatedRecord.
 * Importing the text-field spec alone is safe: its import chain (form types,
 * fallback renderer types, MUI wrappers) never reaches DataView.
 *
 * {@link ./registry.ts} populates {@link FIELD_REGISTRY} at module load.
 * Package entry exports fieldRegistry before rendering, so the map is ready
 * before DataView runs.
 */

/**
 * Shared map from `namespace::name` to {@link FieldInfo}.
 *
 * Holds both canonical specs and legacy aliases. Populated by
 * {@link ./registry.ts} at module load — do not mutate from callers outside
 * registry setup.
 */
export const FIELD_REGISTRY: Map<string, FieldInfo<any>> = new Map();

/**
 * Builds the registry lookup key for a component namespace and name.
 *
 * @param args - Component identity
 * @param args.namespace - UI-spec `component-namespace` (e.g. `faims-custom`)
 * @param args.name - UI-spec `component-name` (e.g. `RelatedRecordSelector`)
 * @returns Key in the form `namespace::name`
 */
export function buildRegistryKey({
  namespace,
  name,
}: {
  namespace: string;
  name: string;
}): string {
  return `${namespace}::${name}`;
}

/**
 * Parses a registry key produced by {@link buildRegistryKey} back into its
 * namespace and name parts.
 *
 * @param key - Registry key (`namespace::name`)
 * @returns The split namespace and name
 * @throws If `key` does not contain exactly one `::` separator
 */
export function splitRegistryKey(key: string): {
  namespace: string;
  name: string;
} {
  const parts = key.split('::');
  if (parts.length !== 2) {
    throw new Error(`Invalid key: ${key}`);
  }
  return {
    namespace: parts[0],
    name: parts[1],
  };
}

/**
 * Resolves field info for a UI-spec component namespace and name.
 *
 * Looks up {@link FIELD_REGISTRY} first. If the key is missing, returns the
 * text-field spec and sets `fallback: true` so callers can warn about
 * unrecognised types.
 *
 * @param args - Component identity from the UI specification
 * @param args.namespace - UI-spec `component-namespace`
 * @param args.name - UI-spec `component-name`
 * @returns `fieldInfo` for rendering/validation, and whether it was a fallback
 */
export const getFieldInfo = ({
  namespace,
  name,
}: {
  namespace: string;
  name: string;
}): {fieldInfo: FieldInfo<any>; fallback: boolean} => {
  const key = buildRegistryKey({namespace, name});
  const fieldInfo = FIELD_REGISTRY.get(key);
  if (fieldInfo) return {fieldInfo, fallback: false};
  return {fieldInfo: textFieldSpec, fallback: true};
};

/**
 * Component identities that must never be rendered at runtime.
 *
 * Narrow exception list only — do **not** add deprecated fields here or they
 * will silently disappear from existing notebooks. Hide deprecated types from
 * the designer chooser instead (`showInChooser: false`) and migrate live data.
 */
export const FORCE_IGNORED_FIELDS: Array<{name: string; namespace: string}> = [
  {
    namespace: 'faims-custom',
    name: 'BasicAutoIncrementer',
  },
];
