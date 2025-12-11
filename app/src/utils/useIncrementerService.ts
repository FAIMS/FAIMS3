import {useCallback, useMemo} from 'react';
import {ProjectID} from '@faims3/data-model';
import {
  AutoIncrementService,
  AutoIncrementFieldRef,
  AutoIncrementer as AutoIncrementerInterface,
  AutoIncrementRange,
  AutoIncrementStatus,
} from '@faims3/forms';
import {
  AutoIncrementer,
  getAutoincrementReferencesForProject,
} from '../local-data/autoincrement';

/**
 * Creates an AutoIncrementerInterface wrapper around the existing AutoIncrementer class
 */
function createIncrementerWrapper(
  projectId: ProjectID,
  ref: AutoIncrementFieldRef
): AutoIncrementerInterface {
  const incrementer = new AutoIncrementer(projectId, ref.formId, ref.fieldId);

  return {
    getNextValue: async () => {
      return await incrementer.nextValue();
    },

    getNextValueFormatted: async (numDigits: number) => {
      const value = await incrementer.nextValue();
      if (value === undefined) {
        return undefined;
      }
      return value.toString().padStart(numDigits, '0');
    },

    getRanges: async () => {
      const ranges = await incrementer.getRanges();
      // Map to the public interface (camelCase)
      return ranges.map(r => ({
        start: r.start,
        stop: r.stop,
        fullyUsed: r.fully_used,
        using: r.using,
      }));
    },

    addRange: async (start: number, stop: number) => {
      await incrementer.addRange({start, stop});
    },

    removeRange: async (index: number) => {
      await incrementer.removeRange(index);
    },

    updateRange: async (index: number, range: AutoIncrementRange) => {
      await incrementer.updateRange(index, {
        start: range.start,
        stop: range.stop,
        fully_used: range.fullyUsed,
        using: range.using,
      });
    },

    setLastUsed: async (value: number) => {
      await incrementer.setLastUsed(value);
    },

    getStatus: async (label: string) => {
      const state = await incrementer.getState();
      const lastUsed = state.last_used_id;

      // Calculate remaining values across all non-exhausted ranges
      let remaining = 0;
      let currentRangeEnd: number | null = null;

      for (const range of state.ranges) {
        if (range.using) {
          currentRangeEnd = range.stop;
          // Remaining in current range
          if (lastUsed !== null) {
            remaining += range.stop - lastUsed;
          } else {
            remaining += range.stop - range.start + 1;
          }
        } else if (!range.fully_used) {
          // Full range available
          remaining += range.stop - range.start + 1;
        }
      }

      return {
        label,
        lastUsed,
        currentRangeEnd,
        remaining: state.ranges.length > 0 ? remaining : null,
      };
    },

    hasAvailableValues: async () => {
      const state = await incrementer.getState();

      if (state.ranges.length === 0) {
        return false;
      }

      // Check if there's room in current range
      for (const range of state.ranges) {
        if (range.using) {
          if (state.last_used_id === null || state.last_used_id < range.stop) {
            return true;
          }
        } else if (!range.fully_used) {
          return true;
        }
      }

      return false;
    },
  };
}

/**
 * Custom hook that provides an AutoIncrementService for a project.
 *
 * @param projectId - The project identifier
 * @returns AutoIncrementService interface for managing auto-incrementers
 */
export function useAutoIncrementService({
  projectId,
  onIssue,
}: {
  projectId: ProjectID;
  onIssue: (fieldRefs: AutoIncrementFieldRef[], onResolved: () => void) => void;
}): AutoIncrementService {
  const getIncrementer = useCallback(
    (ref: AutoIncrementFieldRef): AutoIncrementerInterface => {
      return createIncrementerWrapper(projectId, ref);
    },
    [projectId]
  );

  const getFieldRefs = useCallback(async () => {
    const refs = await getAutoincrementReferencesForProject(projectId);
    return refs.map(ref => ({
      formId: ref.form_id,
      fieldId: ref.field_id,
      fieldLabel: ref.label ?? ref.field_id,
      numDigits: ref.numDigits,
    }));
  }, [projectId]);

  const getAllStatuses = useCallback(async (): Promise<
    AutoIncrementStatus[]
  > => {
    const refs = await getFieldRefs();
    const statuses: AutoIncrementStatus[] = [];

    for (const ref of refs) {
      const incrementer = getIncrementer(ref);
      const status = await incrementer.getStatus(ref.fieldLabel ?? ref.fieldId);
      statuses.push(status);
    }

    return statuses;
  }, [getFieldRefs, getIncrementer]);

  const generateInitialValues = useCallback(
    async (
      formId: string,
      numDigits: number = 4
    ): Promise<Record<string, string>> => {
      const refs = await getFieldRefs();
      const formRefs = refs.filter(ref => ref.formId === formId);
      const values: Record<string, string> = {};

      for (const ref of formRefs) {
        const incrementer = getIncrementer(ref);
        const value = await incrementer.getNextValueFormatted(numDigits);
        if (value !== undefined) {
          values[ref.fieldId] = value;
        }
      }

      return values;
    },
    [getFieldRefs, getIncrementer]
  );

  return useMemo(
    () => ({
      getIncrementer,
      getFieldRefs,
      getAllStatuses,
      generateInitialValues,
      onIssue,
    }),
    [
      getIncrementer,
      getFieldRefs,
      getAllStatuses,
      generateInitialValues,
      onIssue,
    ]
  );
}
