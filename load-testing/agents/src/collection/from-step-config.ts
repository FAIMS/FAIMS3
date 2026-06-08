import {CollectionProfileSchema, type CollectionProfile} from '@faims3/load-testing-shared';

export function collectionProfileFromStepConfig(
  config: Record<string, unknown>
): CollectionProfile | undefined {
  const raw = config.collectionProfile;
  if (raw === undefined) {
    return undefined;
  }
  return CollectionProfileSchema.parse(raw);
}
