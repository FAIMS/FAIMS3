import {
  NotebookDefinition,
  normalizeNotebookUiSpecification,
  notebookUiSpecificationValidationMessage,
} from '@faims3/data-model';
import * as Exceptions from '../exceptions';

/**
 * Migrate legacy notebook JSON when needed, validate as {@link NotebookDefinition},
 * and map failures to {@link Exceptions.ValidationException}.
 */
export function normalizeUiSpecificationOrThrow(
  raw: unknown
): NotebookDefinition {
  try {
    return normalizeNotebookUiSpecification(raw);
  } catch (error) {
    throw new Exceptions.ValidationException(
      notebookUiSpecificationValidationMessage(error)
    );
  }
}
