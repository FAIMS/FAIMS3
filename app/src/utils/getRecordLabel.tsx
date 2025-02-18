import {getUiSpecForProject} from '../uiSpecification';

/**
 * Fetches the dynamically assigned label for records (e.g., "Sites", "Responses").
 * Defaults to "Record" if no specific label is found.
 *
 * @param {string} projectId - The ID of the project.
 * @returns {Promise<string>} - The label to be used for records in the project.
 */
export async function getRecordLabel(projectId: string): Promise<string> {
  try {
    const uiSpec = await getUiSpecForProject(projectId);

    if (uiSpec?.visible_types?.length === 1) {
      return (
        uiSpec.viewsets[uiSpec.visible_types[0]]?.label ||
        uiSpec.visible_types[0] // Fallback to type name if label is unavailable
      );
    }
  } catch (error) {
    console.error('Error fetching record label:', error);
  }

  return 'Record'; // default
}
